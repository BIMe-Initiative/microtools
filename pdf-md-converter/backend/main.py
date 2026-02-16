import asyncio
import io
import json
import logging
import secrets
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from fastapi import (
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    Header,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from .config import get_settings
from .formatter import ObsidianMarkdownFormatter
from .models import (
    AnalyzeRequest,
    AnalyzeResponse,
    AuthResponse,
    AuthUser,
    GoogleAuthRequest,
    JobRecord,
    JobStatus,
    JobStatusResponse,
    PreviewResponse,
    UploadResponse,
)
from .ocr_service import MistralOCRService
from .storage import GCSStorage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()
session_serializer: URLSafeTimedSerializer | None = (
    URLSafeTimedSerializer(settings.session_secret)
    if settings.session_secret
    else None
)

app = FastAPI(
    title="PDF to Markdown Converter",
    description="Convert PDFs to Obsidian-compatible Markdown using Mistral OCR",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Services
upload_bucket = settings.gcs_upload_bucket_name or settings.gcs_bucket_name
results_bucket = settings.gcs_results_bucket_name or settings.gcs_bucket_name
formatter = ObsidianMarkdownFormatter()
upload_storage: GCSStorage | None = None
results_storage: GCSStorage | None = None
ocr_service: MistralOCRService | None = None

# In-memory job store
jobs: dict[str, JobRecord] = {}


def _get_upload_storage() -> GCSStorage:
    global upload_storage
    if upload_storage is None:
        upload_storage = GCSStorage(upload_bucket)
    return upload_storage


def _get_results_storage() -> GCSStorage:
    global results_storage
    if results_storage is None:
        results_storage = GCSStorage(results_bucket)
    return results_storage


def _get_ocr_service() -> MistralOCRService:
    global ocr_service
    if ocr_service is None:
        ocr_service = MistralOCRService()
    return ocr_service


def _require_api_key(x_api_key: str | None = Header(None)):
    """Optionally require API key if API_KEY is configured."""
    if not settings.api_key:
        return
    if not x_api_key or not secrets.compare_digest(x_api_key, settings.api_key):
        raise HTTPException(status_code=401, detail="Unauthorized")


def _require_configured_auth():
    if not settings.google_client_id:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID is not configured")
    if not session_serializer:
        raise HTTPException(status_code=500, detail="SESSION_SECRET is not configured")


def _load_session_user(request: Request) -> AuthUser:
    _require_configured_auth()
    token = request.cookies.get("session")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = session_serializer.loads(  # type: ignore[union-attr]
            token, max_age=settings.session_max_age_seconds
        )
    except SignatureExpired:
        raise HTTPException(status_code=401, detail="Session expired")
    except BadSignature:
        raise HTTPException(status_code=401, detail="Invalid session")
    return AuthUser.model_validate(payload)


def _set_session_cookie(response: Response, user: AuthUser, request: Request):
    token = session_serializer.dumps(user.model_dump())  # type: ignore[union-attr]
    response.set_cookie(
        key="session",
        value=token,
        httponly=True,
        secure=request.url.scheme == "https",
        samesite="lax",
        max_age=settings.session_max_age_seconds,
    )


def _clear_session_cookie(response: Response):
    response.delete_cookie("session")


def _verify_job_owner(job: JobRecord, user: AuthUser):
    if job.owner_email and job.owner_email != user.email:
        raise HTTPException(status_code=403, detail="Forbidden")


def _job_metadata_path(job_id: str) -> str:
    return f"jobs/{job_id}.json"


def _persist_job(job: JobRecord):
    jobs[job.job_id] = job
    payload = json.dumps(job.model_dump(mode="json")).encode("utf-8")
    try:
        _get_results_storage().upload_bytes(
            payload,
            _job_metadata_path(job.job_id),
            "application/json",
        )
    except Exception as exc:
        logger.error("Failed to persist job metadata for %s: %s", job.job_id, exc)


def _load_job(job_id: str) -> JobRecord | None:
    in_mem = jobs.get(job_id)
    if in_mem is not None:
        return in_mem
    try:
        payload = _get_results_storage().download_as_bytes(_job_metadata_path(job_id))
    except Exception:
        return None
    try:
        job = JobRecord.model_validate(json.loads(payload.decode("utf-8")))
    except Exception as exc:
        logger.error("Failed to load job metadata for %s: %s", job_id, exc)
        return None
    jobs[job_id] = job
    return job


# ---------------------------------------------------------------------------
# Background cleanup
# ---------------------------------------------------------------------------
async def _cleanup_old_jobs():
    """Periodically remove expired jobs and their GCS artifacts."""
    while True:
        await asyncio.sleep(3600)
        cutoff = datetime.now() - timedelta(hours=settings.job_retention_hours)
        expired = [jid for jid, j in jobs.items() if j.created_at < cutoff]
        for jid in expired:
            job = jobs.pop(jid, None)
            if job is None:
                continue
            if job.gcs_pdf_path:
                _get_upload_storage().delete_file(
                    job.gcs_pdf_path.replace(f"gs://{upload_bucket}/", "")
                )
            if job.md_gcs_path:
                _get_results_storage().delete_file(
                    job.md_gcs_path.replace(f"gs://{results_bucket}/", "")
                )
            if job.zip_gcs_path:
                _get_results_storage().delete_file(
                    job.zip_gcs_path.replace(f"gs://{results_bucket}/", "")
                )
            _get_results_storage().delete_file(_job_metadata_path(jid))
            logger.info(f"Cleaned up expired job {jid}")


@app.on_event("startup")
async def _startup():
    asyncio.create_task(_cleanup_old_jobs())


# ---------------------------------------------------------------------------
# API endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "healthy", "service": "pdf-md-converter"}


@app.post("/api/auth/google", response_model=AuthResponse)
async def auth_google(request: Request, response: Response, body: GoogleAuthRequest):
    _require_configured_auth()
    try:
        claims = id_token.verify_oauth2_token(
            body.credential,
            google_requests.Request(),
            settings.google_client_id,
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Google credential")

    email = claims.get("email")
    if not email or not claims.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google account email is not verified")

    allowed_emails = {e.lower() for e in settings.auth_allowed_emails}
    allowed_domains = {d.lower() for d in settings.auth_allowed_domains}
    email_normalized = email.lower()
    email_domain = email_normalized.split("@")[-1]

    has_email_allowlist = len(allowed_emails) > 0
    has_domain_allowlist = len(allowed_domains) > 0
    if has_email_allowlist or has_domain_allowlist:
        email_allowed = email_normalized in allowed_emails
        domain_allowed = email_domain in allowed_domains
        if not (email_allowed or domain_allowed):
            raise HTTPException(status_code=403, detail="Email is not allowlisted")

    user = AuthUser(
        email=email,
        name=claims.get("name"),
        picture=claims.get("picture"),
    )
    _set_session_cookie(response, user, request)
    return AuthResponse(user=user)


@app.get("/api/auth/me", response_model=AuthResponse)
async def auth_me(request: Request):
    user = _load_session_user(request)
    return AuthResponse(user=user)


@app.post("/api/auth/logout")
async def auth_logout(response: Response):
    _clear_session_cookie(response)
    return {"ok": True}


@app.post("/api/upload", response_model=UploadResponse)
async def upload_pdf(
    background_tasks: BackgroundTasks,
    request: Request,
    file: UploadFile = File(...),
    vault_mode: bool = Query(False),
    type: Optional[str] = Query(None),
    subtype: Optional[str] = Query(None),
    use_scope: Optional[str] = Query(None),
    access_level: Optional[str] = Query(None),
    export_targets: list[str] = Query([]),
    _: None = Depends(_require_api_key),
):
    """Upload a PDF and start OCR processing."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    content = await file.read()
    if not _get_ocr_service().validate_document_size(len(content)):
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds the {settings.max_file_size_mb}MB limit",
        )

    job_id = str(uuid.uuid4())
    job = JobRecord(
        job_id=job_id,
        status=JobStatus.UPLOADING,
        original_filename=file.filename,
        owner_email=_load_session_user(request).email,
        created_at=datetime.now(),
        vault_mode=vault_mode,
        kos_type=type,
        kos_subtype=subtype,
        kos_use_scope=use_scope,
        kos_access_level=access_level,
        kos_export_targets=export_targets,
    )
    _persist_job(job)

    # Upload to GCS
    try:
        gcs_path = f"uploads/{job_id}/{file.filename}"
        gcs_uri = _get_upload_storage().upload_file(
            io.BytesIO(content), gcs_path, content_type="application/pdf"
        )
        job.gcs_pdf_path = gcs_uri
        job.status = JobStatus.PROCESSING
        _persist_job(job)
    except Exception as exc:
        job.status = JobStatus.FAILED
        job.error = str(exc)
        _persist_job(job)
        logger.error(f"GCS upload failed for job {job_id}: {exc}")
        raise HTTPException(status_code=500, detail="Failed to upload file")

    background_tasks.add_task(_process_pdf, job_id)

    return UploadResponse(
        job_id=job_id,
        status=JobStatus.PROCESSING,
        message="PDF uploaded. Processing started.",
    )


async def _process_pdf(job_id: str):
    """Background task: run OCR, format markdown, create zip."""
    job = _load_job(job_id)
    if job is None:
        return

    try:
        # Generate a signed URL so Mistral can access the PDF
        gcs_relative = job.gcs_pdf_path.replace(
            f"gs://{upload_bucket}/", ""
        )
        signed_url = _get_upload_storage().generate_signed_url(
            gcs_relative, expiration_minutes=60
        )

        async def _update(j: JobRecord):
            _persist_job(j)

        ocr_result = await _get_ocr_service().process_document(signed_url, job, _update)

        # Format to Obsidian markdown
        md_content, attachments = formatter.format_document(
            ocr_result, job
        )
        job.markdown_content = md_content

        stem = Path(job.original_filename).stem
        md_gcs_path = f"results/{job_id}/{stem}.md"
        job.md_gcs_path = _get_results_storage().upload_bytes(
            md_content.encode("utf-8"),
            md_gcs_path,
            "text/markdown; charset=utf-8",
        )

        # Build zip and store in GCS
        zip_bytes = formatter.create_zip_archive(md_content, attachments, stem)
        zip_gcs_path = f"results/{job_id}/{stem}.zip"
        job.zip_gcs_path = _get_results_storage().upload_bytes(
            zip_bytes, zip_gcs_path, "application/zip"
        )

        job.status = JobStatus.COMPLETED
        job.completed_at = datetime.now()
        _persist_job(job)
        logger.info(f"Job {job_id} completed")

    except Exception as exc:
        job.status = JobStatus.FAILED
        job.error = str(exc)
        job.completed_at = datetime.now()
        _persist_job(job)
        logger.error(f"Job {job_id} failed: {exc}")


@app.get("/api/status/{job_id}", response_model=JobStatusResponse)
async def get_status(job_id: str, request: Request):
    """Poll the status of a processing job."""
    job = _load_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    _verify_job_owner(job, _load_session_user(request))

    progress = None
    if job.total_pages and job.total_pages > 0:
        progress = int((job.processed_pages / job.total_pages) * 100)

    msg = None
    if job.total_pages:
        msg = f"Processed {job.processed_pages}/{job.total_pages} pages"

    return JobStatusResponse(
        job_id=job.job_id,
        status=job.status,
        progress=progress,
        message=msg,
        error=job.error,
        created_at=job.created_at,
        completed_at=job.completed_at,
        result_available=job.status == JobStatus.COMPLETED,
    )


@app.get("/api/preview/{job_id}", response_model=PreviewResponse)
async def get_preview(job_id: str, request: Request):
    """Return the converted markdown for in-browser preview."""
    job = _load_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    _verify_job_owner(job, _load_session_user(request))
    if job.status != JobStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Job not completed yet")
    if not job.markdown_content and job.md_gcs_path:
        try:
            rel_path = job.md_gcs_path.replace(f"gs://{results_bucket}/", "")
            job.markdown_content = _get_results_storage().download_as_bytes(rel_path).decode(
                "utf-8"
            )
            _persist_job(job)
        except Exception as exc:
            logger.error(f"Markdown download failed for job {job_id}: {exc}")
            raise HTTPException(status_code=500, detail="Markdown content unavailable")
    elif not job.markdown_content:
        raise HTTPException(status_code=500, detail="Markdown content unavailable")

    return PreviewResponse(job_id=job.job_id, markdown=job.markdown_content)


@app.get("/api/download/{job_id}")
async def download_result(job_id: str, request: Request):
    """Download the result zip archive."""
    job = _load_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    _verify_job_owner(job, _load_session_user(request))
    if job.status != JobStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Job not completed yet")
    if not job.zip_gcs_path:
        raise HTTPException(status_code=500, detail="Result file not found")

    try:
        rel_path = job.zip_gcs_path.replace(
            f"gs://{results_bucket}/", ""
        )
        zip_bytes = _get_results_storage().download_as_bytes(rel_path)
        stem = Path(job.original_filename).stem
        return StreamingResponse(
            io.BytesIO(zip_bytes),
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="{stem}_obsidian.zip"'
            },
        )
    except Exception as exc:
        logger.error(f"Download failed for job {job_id}: {exc}")
        raise HTTPException(status_code=500, detail="Download failed")


@app.post("/api/analyze/{job_id}", response_model=AnalyzeResponse)
async def analyze_document(
    job_id: str,
    request: Request,
    body: AnalyzeRequest,
    _: None = Depends(_require_api_key),
):
    """Send the converted markdown to Vertex AI Gemini for analysis."""
    job = _load_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    _verify_job_owner(job, _load_session_user(request))
    if job.status != JobStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Job not completed yet")
    if not job.markdown_content and job.md_gcs_path:
        rel_path = job.md_gcs_path.replace(f"gs://{results_bucket}/", "")
        job.markdown_content = _get_results_storage().download_as_bytes(rel_path).decode(
            "utf-8"
        )
    if not job.markdown_content:
        raise HTTPException(status_code=500, detail="Markdown content unavailable")

    try:
        import vertexai
        from vertexai.generative_models import GenerativeModel

        vertexai.init(
            project=settings.gcp_project_id,
            location=settings.vertex_ai_location,
        )
        model = GenerativeModel("gemini-2.0-flash")
        prompt = f"{body.prompt}\n\nDocument Content:\n{job.markdown_content}"
        response = model.generate_content(prompt)

        token_count = None
        if hasattr(response, "usage_metadata"):
            token_count = getattr(
                response.usage_metadata, "total_token_count", None
            )

        return AnalyzeResponse(
            job_id=job_id,
            analysis=response.text,
            token_count=token_count,
        )
    except Exception as exc:
        logger.error(f"Analysis failed for job {job_id}: {exc}")
        raise HTTPException(
            status_code=500, detail=f"Analysis failed: {exc}"
        )


# ---------------------------------------------------------------------------
# Static file serving (Next.js build) — must be mounted LAST
# ---------------------------------------------------------------------------
_static_dir = Path(__file__).resolve().parent.parent / "frontend" / "out"
if _static_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(_static_dir), html=True), name="static")

import asyncio
import io
import json
import logging
import secrets
import uuid
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import (
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    Header,
    HTTPException,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .formatter import ObsidianMarkdownFormatter
from .models import (
    AnalyzeRequest,
    AnalyzeResponse,
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
upload_storage = GCSStorage(upload_bucket)
results_storage = GCSStorage(results_bucket)
ocr_service = MistralOCRService()
formatter = ObsidianMarkdownFormatter()

# In-memory job store
jobs: dict[str, JobRecord] = {}


def _require_api_key(x_api_key: str | None = Header(None)):
    """Optionally require API key if API_KEY is configured."""
    if not settings.api_key:
        return
    if not x_api_key or not secrets.compare_digest(x_api_key, settings.api_key):
        raise HTTPException(status_code=401, detail="Unauthorized")


def _job_metadata_path(job_id: str) -> str:
    return f"jobs/{job_id}.json"


def _persist_job(job: JobRecord):
    jobs[job.job_id] = job
    payload = json.dumps(job.model_dump(mode="json")).encode("utf-8")
    try:
        results_storage.upload_bytes(
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
        payload = results_storage.download_as_bytes(_job_metadata_path(job_id))
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
                upload_storage.delete_file(
                    job.gcs_pdf_path.replace(f"gs://{upload_bucket}/", "")
                )
            if job.md_gcs_path:
                results_storage.delete_file(
                    job.md_gcs_path.replace(f"gs://{results_bucket}/", "")
                )
            if job.zip_gcs_path:
                results_storage.delete_file(
                    job.zip_gcs_path.replace(f"gs://{results_bucket}/", "")
                )
            results_storage.delete_file(_job_metadata_path(jid))
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


@app.post("/api/upload", response_model=UploadResponse)
async def upload_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    _: None = Depends(_require_api_key),
):
    """Upload a PDF and start OCR processing."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    content = await file.read()
    if not ocr_service.validate_document_size(len(content)):
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds the {settings.max_file_size_mb}MB limit",
        )

    job_id = str(uuid.uuid4())
    job = JobRecord(
        job_id=job_id,
        status=JobStatus.UPLOADING,
        original_filename=file.filename,
        created_at=datetime.now(),
    )
    _persist_job(job)

    # Upload to GCS
    try:
        gcs_path = f"uploads/{job_id}/{file.filename}"
        gcs_uri = upload_storage.upload_file(
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
        signed_url = upload_storage.generate_signed_url(
            gcs_relative, expiration_minutes=60
        )

        async def _update(j: JobRecord):
            _persist_job(j)

        ocr_result = await ocr_service.process_document(signed_url, job, _update)

        # Format to Obsidian markdown
        md_content, attachments = formatter.format_document(
            ocr_result, job.original_filename
        )
        job.markdown_content = md_content

        stem = Path(job.original_filename).stem
        md_gcs_path = f"results/{job_id}/{stem}.md"
        job.md_gcs_path = results_storage.upload_bytes(
            md_content.encode("utf-8"),
            md_gcs_path,
            "text/markdown; charset=utf-8",
        )

        # Build zip and store in GCS
        zip_bytes = formatter.create_zip_archive(md_content, attachments, stem)
        zip_gcs_path = f"results/{job_id}/{stem}.zip"
        job.zip_gcs_path = results_storage.upload_bytes(
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
async def get_status(job_id: str):
    """Poll the status of a processing job."""
    job = _load_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

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
async def get_preview(job_id: str):
    """Return the converted markdown for in-browser preview."""
    job = _load_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != JobStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Job not completed yet")
    if not job.markdown_content and job.md_gcs_path:
        try:
            rel_path = job.md_gcs_path.replace(f"gs://{results_bucket}/", "")
            job.markdown_content = results_storage.download_as_bytes(rel_path).decode(
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
async def download_result(job_id: str):
    """Download the result zip archive."""
    job = _load_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != JobStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Job not completed yet")
    if not job.zip_gcs_path:
        raise HTTPException(status_code=500, detail="Result file not found")

    try:
        rel_path = job.zip_gcs_path.replace(
            f"gs://{results_bucket}/", ""
        )
        zip_bytes = results_storage.download_as_bytes(rel_path)
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
    request: AnalyzeRequest,
    _: None = Depends(_require_api_key),
):
    """Send the converted markdown to Vertex AI Gemini for analysis."""
    job = _load_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != JobStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Job not completed yet")
    if not job.markdown_content and job.md_gcs_path:
        rel_path = job.md_gcs_path.replace(f"gs://{results_bucket}/", "")
        job.markdown_content = results_storage.download_as_bytes(rel_path).decode(
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
        prompt = f"{request.prompt}\n\nDocument Content:\n{job.markdown_content}"
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

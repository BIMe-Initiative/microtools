import io
import logging
import re
import tempfile
from typing import Any, Callable, Optional

import google.auth
import google.auth.transport.requests
import httpx
from mistralai_gcp import MistralGoogleCloud
from pypdf import PdfReader, PdfWriter

from .config import get_settings
from .models import JobRecord

logger = logging.getLogger(__name__)


class MistralOCRService:
    def __init__(self, settings=None):
        self._settings = settings or get_settings()
        self._client: Optional[MistralGoogleCloud] = None

    @property
    def client(self) -> MistralGoogleCloud:
        if self._client is None:
            self._client = MistralGoogleCloud(
                region=self._settings.mistral_region,
                project_id=self._settings.gcp_project_id,
            )
        return self._client

    async def process_document(
        self,
        document_url: str,
        job_record: JobRecord,
        on_progress: Optional[Callable] = None,
        storage_client: Any = None,
    ) -> dict[str, Any]:
        """
        Process a PDF document with Mistral OCR.
        If document exceeds 30 pages, it will be split into chunks.
        """
        logger.info(f"Starting OCR for job {job_record.job_id}")
        max_pages = self._settings.max_pages_per_request
        seen_pages: dict[int, dict[str, Any]] = {}

        # 1. Inspect document to see if splitting is needed
        # Since we have a signed URL, we need to download it or be passed the content.
        # For simplicity and robustness, we'll download it here.
        async with httpx.AsyncClient() as h_client:
            res = await h_client.get(document_url)
            if res.status_code != 200:
                raise RuntimeError(f"Failed to download PDF from {document_url}: {res.status_code}")
            pdf_bytes = res.content

        reader = PdfReader(io.BytesIO(pdf_bytes))
        total_pages_count = len(reader.pages)
        logger.info(f"Job {job_record.job_id} has {total_pages_count} pages")

        current_page_offset = 0
        while current_page_offset < total_pages_count:
            chunk_size = min(max_pages, total_pages_count - current_page_offset)
            page_indices = list(range(current_page_offset, current_page_offset + chunk_size))
            
            # If total document is <= 30 pages, process it directly via original URL
            if total_pages_count <= max_pages:
                logger.info(f"Processing small document (pages {page_indices}) directly")
                batch_res = self._process_ocr_batch(document_url, page_indices)
                self._collect_pages(batch_res, seen_pages)
                current_page_offset += chunk_size
            else:
                # Splitting needed. Create a new PDF for this chunk.
                writer = PdfWriter()
                for i in range(current_page_offset, current_page_offset + chunk_size):
                    writer.add_page(reader.pages[i])
                
                chunk_pdf = io.BytesIO()
                writer.write(chunk_pdf)
                chunk_pdf.seek(0)
                
                # Upload chunk temporarily if storage client is available
                if not storage_client:
                    raise RuntimeError("Large document processing requires storage_client to be passed to MistralOCRService")
                
                chunk_path = f"temp/{job_record.job_id}/chunk_{current_page_offset}.pdf"
                chunk_url = storage_client.upload_file(
                    chunk_pdf, chunk_path, content_type="application/pdf"
                )
                
                # Sign the chunk URL
                signed_chunk_url = storage_client.generate_signed_url(chunk_path, expiration_minutes=60)
                
                logger.info(f"Processing chunk {current_page_offset} (pages 0-{chunk_size-1} of chunk)")
                # Mistral sees this chunk as a new 0-indexed document
                batch_res = self._process_ocr_batch(signed_chunk_url, list(range(chunk_size)))
                
                # Collect and adjust indices
                self._collect_pages(batch_res, seen_pages, index_offset=current_page_offset)
                
                # Cleanup temp chunk
                try:
                    storage_client.delete_file(chunk_path)
                except Exception as e:
                    logger.warning(f"Failed to cleanup temp chunk {chunk_path}: {e}")
                
                current_page_offset += chunk_size

            # Update progress
            job_record.processed_pages = len(seen_pages)
            job_record.total_pages = total_pages_count
            if on_progress:
                await on_progress(job_record)

        all_pages = [seen_pages[idx] for idx in sorted(seen_pages)]
        return {"pages": all_pages}

    def _collect_pages(self, response: Any, seen_pages: dict, index_offset: int = 0):
        raw_pages = response.pages if hasattr(response, "pages") else []
        for page in raw_pages:
            serialized = self._serialize_page(page)
            # Adjust index if it's from a chunk
            page_index = serialized["index"] + index_offset
            serialized["index"] = page_index
            seen_pages[page_index] = serialized

    def _process_ocr_batch(self, document_url: str, page_indices: list[int]):
        """Run one OCR batch."""
        if hasattr(self.client, "ocr"):
            return self.client.ocr.process(
                model=self._settings.mistral_model,
                document={"type": "document_url", "document_url": document_url},
                include_image_base64=True,
                pages=page_indices,
            )
        return self._process_ocr_via_raw_predict(document_url, page_indices)

    def _process_ocr_via_raw_predict(
        self, document_url: str, page_indices: list[int]
    ) -> Any:
        creds, _ = google.auth.default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        creds.refresh(google.auth.transport.requests.Request())
        token = creds.token
        if not token:
            raise RuntimeError("Failed to obtain Google access token for OCR request")

        base = f"https://{self._settings.mistral_region}-aiplatform.googleapis.com"
        errors: list[str] = []
        for model_name, model_id in self._model_candidates(self._settings.mistral_model):
            url = (
                f"{base}/v1/projects/{self._settings.gcp_project_id}"
                f"/locations/{self._settings.mistral_region}"
                f"/publishers/mistralai/models/{model_id}:rawPredict"
            )
            payload = {
                "model": model_name,
                "document": {"type": "document_url", "document_url": document_url},
                "include_image_base64": True,
                "pages": page_indices,
            }
            res = httpx.post(
                url,
                json=payload,
                headers={"Authorization": f"Bearer {token}"},
                timeout=180,
            )
            if res.status_code == 200:
                data = res.json()
                if isinstance(data, dict) and "pages" in data:
                    return type("OCRResult", (), data)
                raise RuntimeError(f"Unexpected OCR response shape: {data}")

            # Try next candidate on model routing errors.
            if res.status_code in (400, 404):
                errors.append(f"{model_id}: {res.status_code} {res.text}")
                continue

            raise RuntimeError(
                f"OCR request failed ({res.status_code}): {res.text}"
            )

        raise RuntimeError(
            "OCR model invocation failed for all model IDs: " + " | ".join(errors)
        )

    def _model_candidates(self, configured_model: str) -> list[tuple[str, str]]:
        candidates: list[tuple[str, str]] = []
        
        # Vertex AI - Mistral OCR favored ID
        if configured_model == "mistral-ocr-2505":
             candidates.append(("mistral-ocr", "mistral-ocr-2505"))
             candidates.append(("mistral-ocr", "mistral-ocr@2505"))
        
        # Generic fallback
        match = re.match(r"^(.+)-(\d{4})$", configured_model)
        if match:
            candidates.append((match.group(1), f"{match.group(1)}-{match.group(2)}"))
            candidates.append((match.group(1), f"{match.group(1)}@{match.group(2)}"))

        # Last fallback to exact configured model string
        candidates.append((configured_model, configured_model))

        unique: list[tuple[str, str]] = []
        seen = set()
        for pair in candidates:
            if pair not in seen:
                unique.append(pair)
                seen.add(pair)
        return unique

    def _serialize_page(self, page: Any) -> dict:
        """Convert an OCR page response object to a plain dict."""
        images = []
        page_images = []
        if isinstance(page, dict):
            page_images = page.get("images") or []
        elif hasattr(page, "images") and page.images:
            page_images = page.images

        for img in page_images:
            if isinstance(img, dict):
                images.append(
                    {
                        "id": img.get("id", str(id(img))),
                        "image_base64": img.get("image_base64", ""),
                    }
                )
            else:
                images.append(
                    {
                        "id": img.id if hasattr(img, "id") else str(id(img)),
                        "image_base64": getattr(img, "image_base64", ""),
                    }
                )
        return {
            "index": (
                page.get("index", 0)
                if isinstance(page, dict)
                else (page.index if hasattr(page, "index") else 0)
            ),
            "markdown": (
                page.get("markdown", "")
                if isinstance(page, dict)
                else (page.markdown if hasattr(page, "markdown") else "")
            ),
            "images": images,
        }

    def validate_document_size(self, file_size_bytes: int) -> bool:
        """Check that file size is within Mistral limits."""
        max_bytes = self._settings.max_file_size_mb * 1024 * 1024
        return file_size_bytes <= max_bytes

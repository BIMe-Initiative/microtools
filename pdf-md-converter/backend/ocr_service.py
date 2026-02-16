import logging
import re
from typing import Any, Callable, Optional

import google.auth
import google.auth.transport.requests
import httpx
from mistralai_gcp import MistralGoogleCloud

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
    ) -> dict[str, Any]:
        """
        Process a PDF document with Mistral OCR.

        Args:
            document_url: Signed HTTPS URL accessible by Mistral.
            job_record: Job record for progress tracking.
            on_progress: Async callback for progress updates.

        Returns:
            Dict with pages containing markdown and images.
        """
        logger.info(f"Starting OCR for job {job_record.job_id}")
        max_pages = self._settings.max_pages_per_request
        seen_pages: dict[int, dict[str, Any]] = {}
        start = 0

        while True:
            end = start + max_pages
            page_indices = list(range(start, end))
            logger.info(
                "Requesting OCR batch for job %s, pages %s-%s",
                job_record.job_id,
                start,
                end - 1,
            )

            response = self._process_ocr_batch(document_url, page_indices)
            raw_pages = response.pages if hasattr(response, "pages") else []
            if not raw_pages:
                break

            new_pages = 0
            for page in raw_pages:
                serialized = self._serialize_page(page)
                page_index = serialized["index"]
                if page_index not in seen_pages:
                    new_pages += 1
                seen_pages[page_index] = serialized

            if new_pages == 0:
                logger.warning(
                    "OCR batch returned no new pages for job %s, stopping to avoid loop",
                    job_record.job_id,
                )
                break

            job_record.processed_pages = len(seen_pages)
            job_record.total_pages = len(seen_pages)
            if on_progress:
                await on_progress(job_record)

            if len(raw_pages) < max_pages:
                break

            start += max_pages

        all_pages = [seen_pages[idx] for idx in sorted(seen_pages)]
        logger.info(
            "OCR complete for job %s: %s pages",
            job_record.job_id,
            len(all_pages),
        )
        return {"pages": all_pages}

    def _process_ocr_batch(self, document_url: str, page_indices: list[int]):
        """
        Run one OCR batch.

        The GCP SDK currently ships without an `ocr` namespace on
        `MistralGoogleCloud` in some versions, so we fallback to direct Vertex
        rawPredict calls for the OCR model.
        """
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
                timeout=120,
            )
            if res.status_code == 200:
                data = res.json()
                # Normalize to object-like response used by existing serializer logic.
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
        # Explicit known OCR model mapping used by Vertex partner routing.
        if configured_model == "mistral-ocr-2505":
            candidates.append(("mistral-ocr", "mistral-ocr@2505"))

        # Generic fallback for dash-version suffix models, e.g. model-2505.
        match = re.match(r"^(.+)-(\d{4})$", configured_model)
        if match:
            candidates.append((match.group(1), f"{match.group(1)}@{match.group(2)}"))

        # Last fallback to exact configured model string.
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

import logging
from typing import Any, Callable, Optional

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

            response = self.client.ocr.process(
                model=self._settings.mistral_model,
                document={"type": "document_url", "document_url": document_url},
                include_image_base64=True,
                pages=page_indices,
            )
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

    def _serialize_page(self, page: Any) -> dict:
        """Convert an OCR page response object to a plain dict."""
        images = []
        if hasattr(page, "images") and page.images:
            for img in page.images:
                images.append(
                    {
                        "id": img.id if hasattr(img, "id") else str(id(img)),
                        "image_base64": getattr(img, "image_base64", ""),
                    }
                )
        return {
            "index": page.index if hasattr(page, "index") else 0,
            "markdown": page.markdown if hasattr(page, "markdown") else "",
            "images": images,
        }

    def validate_document_size(self, file_size_bytes: int) -> bool:
        """Check that file size is within Mistral limits."""
        max_bytes = self._settings.max_file_size_mb * 1024 * 1024
        return file_size_bytes <= max_bytes

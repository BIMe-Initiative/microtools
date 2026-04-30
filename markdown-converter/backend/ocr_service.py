import io
import inspect
import json
import logging
import re
import tempfile
from copy import deepcopy
from typing import Annotated, Any, Callable, Literal, Optional

import google.auth
import google.auth.transport.requests
import httpx
from mistralai.gcp.client import MistralGCP
from pydantic import BaseModel, Field
from pypdf import PdfReader, PdfWriter

from .config import get_settings
from .models import JobRecord

logger = logging.getLogger(__name__)

try:
    from mistralai.extra import response_format_from_pydantic_model
except ImportError:  # pragma: no cover - depends on installed SDK extras
    response_format_from_pydantic_model = None


class BBoxImageAnnotation(BaseModel):
    image_type: Literal[
        "flowchart",
        "process_diagram",
        "system_diagram",
        "chart",
        "table_image",
        "screenshot",
        "photo",
        "logo",
        "signature",
        "decorative",
        "other",
    ] = Field(..., description="Closest type for the extracted image.")

    short_description: str = Field(
        ...,
        max_length=240,
        description=(
            "One concise factual sentence, maximum 40 words, describing what the image communicates. "
            "For flowcharts, process diagrams, lifecycle diagrams, or architecture diagrams, state the main flow from start to end. "
            "Describe only visible content. Do not infer hidden steps or unstated business meaning."
        ),
    )

    flow_steps: list[Annotated[str, Field(max_length=120)]] = Field(
        default_factory=list,
        max_length=8,
        description=(
            "Ordered visible steps for flowcharts, workflows, process diagrams, lifecycle diagrams, or architecture diagrams. "
            "Maximum 8 short items. Empty list if the image is not a flow/process/architecture diagram."
        ),
    )

    key_labels: list[Annotated[str, Field(max_length=80)]] = Field(
        default_factory=list,
        max_length=12,
        description=(
            "Important visible labels, node names, axis labels, legends, or captions. "
            "Maximum 12 short items. Do not invent labels."
        ),
    )

    confidence: Literal["high", "medium", "low"] = Field(
        ...,
        description="Confidence in the description based on image clarity and readable text.",
    )


BBOX_IMAGE_ANNOTATION_RESPONSE_FORMAT: dict[str, Any] = {
    "type": "json_schema",
    "json_schema": {
        "name": "bbox_image_annotation",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "required": [
                "image_type",
                "short_description",
                "flow_steps",
                "key_labels",
                "confidence",
            ],
            "properties": {
                "image_type": {
                    "type": "string",
                    "enum": [
                        "flowchart",
                        "process_diagram",
                        "system_diagram",
                        "chart",
                        "table_image",
                        "screenshot",
                        "photo",
                        "logo",
                        "signature",
                        "decorative",
                        "other",
                    ],
                    "description": "Closest type for the extracted image.",
                },
                "short_description": {
                    "type": "string",
                    "maxLength": 240,
                    "description": (
                        "One concise factual sentence, maximum 40 words, describing what the image communicates. "
                        "For flow/process/architecture diagrams, state the main visible flow from start to end. "
                        "Do not infer hidden steps."
                    ),
                },
                "flow_steps": {
                    "type": "array",
                    "maxItems": 8,
                    "items": {"type": "string", "maxLength": 120},
                    "description": (
                        "Ordered visible steps for flowcharts/workflows/process/architecture diagrams. "
                        "Empty if not applicable."
                    ),
                },
                "key_labels": {
                    "type": "array",
                    "maxItems": 12,
                    "items": {"type": "string", "maxLength": 80},
                    "description": (
                        "Important visible labels, node names, axis labels, legends, or captions. "
                        "Do not invent labels."
                    ),
                },
                "confidence": {
                    "type": "string",
                    "enum": ["high", "medium", "low"],
                    "description": "Confidence based on visual clarity and readable text.",
                },
            },
        },
    },
}


class MistralOCRService:
    def __init__(self, settings=None):
        self._settings = settings or get_settings()
        self._client: Optional[MistralGCP] = None

    @property
    def client(self) -> MistralGCP:
        if self._client is None:
            self._client = MistralGCP(
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
        image_annotations = bool(getattr(job_record, "image_annotations", False))
        while current_page_offset < total_pages_count:
            chunk_size = min(max_pages, total_pages_count - current_page_offset)
            page_indices = list(range(current_page_offset, current_page_offset + chunk_size))
            
            # If total document is <= 30 pages, process it directly via original URL
            if total_pages_count <= max_pages:
                logger.info(f"Processing small document (pages {page_indices}) directly")
                batch_res = self._process_ocr_batch(
                    document_url, page_indices, image_annotations=image_annotations
                )
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
                batch_res = self._process_ocr_batch(
                    signed_chunk_url,
                    list(range(chunk_size)),
                    image_annotations=image_annotations,
                )
                
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

    def _process_ocr_batch(
        self,
        document_url: str,
        page_indices: list[int],
        image_annotations: bool = False,
    ):
        """Run one OCR batch."""
        if hasattr(self.client, "ocr"):
            process = self.client.ocr.process
            kwargs: dict[str, Any] = {
                "model": self._settings.mistral_model,
                "document": {"type": "document_url", "document_url": document_url},
                "include_image_base64": True,
                "pages": page_indices,
            }
            if image_annotations:
                if self._supports_bbox_annotation_format(process):
                    kwargs.update(self._image_annotation_ocr_kwargs())
                else:
                    logger.warning(
                        "Mistral OCR SDK path does not expose bbox_annotation_format; "
                        "continuing without image annotations."
                    )
            return process(**kwargs)
        if image_annotations:
            logger.warning(
                "Mistral rawPredict fallback does not have verified bbox_annotation_format "
                "support; continuing without image annotations."
            )
        return self._process_ocr_via_raw_predict(document_url, page_indices)

    def _supports_bbox_annotation_format(self, process: Callable[..., Any]) -> bool:
        try:
            parameters = inspect.signature(process).parameters
        except (TypeError, ValueError):
            return False
        return "bbox_annotation_format" in parameters or any(
            param.kind == inspect.Parameter.VAR_KEYWORD
            for param in parameters.values()
        )

    def _image_annotation_ocr_kwargs(self) -> dict[str, Any]:
        kwargs: dict[str, Any] = {
            "bbox_annotation_format": self._bbox_annotation_response_format(),
            "image_min_size": self._settings.image_annotation_min_size,
        }
        if self._settings.image_annotation_limit is not None:
            kwargs["image_limit"] = self._settings.image_annotation_limit
        return kwargs

    def _bbox_annotation_response_format(self) -> dict[str, Any]:
        if response_format_from_pydantic_model is not None:
            try:
                return response_format_from_pydantic_model(BBoxImageAnnotation)
            except Exception as exc:
                logger.warning(
                    "Failed to build bbox annotation format from Pydantic model; "
                    "using static JSON schema fallback: %s",
                    exc,
                )
        return deepcopy(BBOX_IMAGE_ANNOTATION_RESPONSE_FORMAT)

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
                serialized_img = {
                    "id": img.get("id", str(id(img))),
                    "image_base64": img.get("image_base64", ""),
                }
            else:
                serialized_img = {
                    "id": img.id if hasattr(img, "id") else str(id(img)),
                    "image_base64": getattr(img, "image_base64", ""),
                }
            annotation = self._extract_image_annotation(img)
            if annotation:
                serialized_img["annotation"] = annotation
            images.append(serialized_img)
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

    def _extract_image_annotation(self, image: Any) -> dict[str, Any] | None:
        for field_name in ("annotation", "bbox_annotation", "image_annotation"):
            if isinstance(image, dict):
                raw_annotation = image.get(field_name)
            else:
                raw_annotation = getattr(image, field_name, None)
            annotation = self._coerce_annotation(raw_annotation)
            if annotation:
                return annotation
        return None

    def _coerce_annotation(self, raw_annotation: Any) -> dict[str, Any] | None:
        if raw_annotation is None or type(raw_annotation).__name__ == "Unset":
            return None
        if isinstance(raw_annotation, dict):
            return raw_annotation
        if isinstance(raw_annotation, str):
            value = raw_annotation.strip()
            if not value:
                return None
            try:
                parsed = json.loads(value)
            except json.JSONDecodeError:
                logger.warning("Skipping malformed OCR image annotation JSON")
                return None
            return parsed if isinstance(parsed, dict) else None
        if hasattr(raw_annotation, "model_dump"):
            dumped = raw_annotation.model_dump(mode="json", exclude_none=True)
            return dumped if isinstance(dumped, dict) else None
        if hasattr(raw_annotation, "dict"):
            dumped = raw_annotation.dict()
            return dumped if isinstance(dumped, dict) else None
        return None

    def validate_document_size(self, file_size_bytes: int) -> bool:
        """Check that file size is within Mistral limits."""
        max_bytes = self._settings.max_file_size_mb * 1024 * 1024
        return file_size_bytes <= max_bytes

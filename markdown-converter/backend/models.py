from pydantic import BaseModel, Field
from enum import Enum
from datetime import datetime
from typing import Optional


class JobStatus(str, Enum):
    UPLOADING = "uploading"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class UploadResponse(BaseModel):
    job_id: str
    status: JobStatus
    message: str


class JobStatusResponse(BaseModel):
    job_id: str
    status: JobStatus
    progress: Optional[int] = None
    message: Optional[str] = None
    error: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    result_available: bool = False


class JobLogItem(BaseModel):
    job_id: str
    status: JobStatus
    original_filename: str
    file_type: Optional[str] = None
    original_content_type: Optional[str] = None
    original_file_size: Optional[int] = None
    owner_email: str = ""
    created_at: datetime
    completed_at: Optional[datetime] = None
    result_available: bool = False
    source_available: bool = False
    markdown_available: bool = False
    source_markdown_available: bool = False
    translated: bool = False
    translation_available: bool = False
    translation_status: Optional[str] = None
    translation_error: Optional[str] = None
    archive_available: bool = False
    error: Optional[str] = None


class JobLogResponse(BaseModel):
    jobs: list[JobLogItem]


class JobDeleteResponse(BaseModel):
    ok: bool


class PreviewResponse(BaseModel):
    job_id: str
    markdown: str
    variant: str = "primary"
    translated: bool = False
    source_language: Optional[str] = None
    target_language: Optional[str] = None


class AnalyzeRequest(BaseModel):
    prompt: str = Field(
        default="Summarize this document and extract key insights.",
        max_length=2000,
    )


class AnalyzeResponse(BaseModel):
    job_id: str
    analysis: str
    token_count: Optional[int] = None


class GoogleAuthRequest(BaseModel):
    credential: str


class AuthUser(BaseModel):
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None


class AuthResponse(BaseModel):
    user: AuthUser


class JobRecord(BaseModel):
    """Internal job state tracking."""

    job_id: str
    status: JobStatus
    original_filename: str = ""
    file_type: Optional[str] = None
    original_content_type: Optional[str] = None
    original_file_size: Optional[int] = None
    owner_email: str = ""
    source_gcs_path: Optional[str] = None
    gcs_pdf_path: Optional[str] = None
    md_gcs_path: Optional[str] = None
    markdown_content: Optional[str] = None
    source_md_gcs_path: Optional[str] = None
    source_markdown_content: Optional[str] = None
    translated_md_gcs_path: Optional[str] = None
    translated_markdown_content: Optional[str] = None
    zip_gcs_path: Optional[str] = None
    total_pages: Optional[int] = None
    processed_pages: int = 0
    image_annotations: bool = False
    translate_to_english: bool = False
    translation_source_language: Optional[str] = None
    translation_target_language: str = "en"
    translation_detected_language: Optional[str] = None
    translation_provider: Optional[str] = None
    translation_status: Optional[str] = None
    translation_error: Optional[str] = None
    error: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    # Vault Mode overrides
    vault_mode: bool = False
    kos_type: Optional[str] = None
    kos_subtype: Optional[str] = None
    kos_use_scope: Optional[str] = None
    kos_access_level: Optional[str] = None
    kos_export_targets: list[str] = []

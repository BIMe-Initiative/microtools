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


class PreviewResponse(BaseModel):
    job_id: str
    markdown: str


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
    owner_email: str = ""
    gcs_pdf_path: Optional[str] = None
    md_gcs_path: Optional[str] = None
    markdown_content: Optional[str] = None
    zip_gcs_path: Optional[str] = None
    total_pages: Optional[int] = None
    processed_pages: int = 0
    error: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

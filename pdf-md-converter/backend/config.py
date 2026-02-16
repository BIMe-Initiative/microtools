from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # GCP
    gcp_project_id: str
    gcp_region: str = "us-central1"
    gcs_bucket_name: str
    gcs_upload_bucket_name: str | None = None
    gcs_results_bucket_name: str | None = None

    # Mistral OCR
    mistral_region: str = "us-central1"
    mistral_model: str = "mistral-ocr-2505"

    # File limits
    max_file_size_mb: int = 100
    max_pages_per_request: int = 100

    # Job management
    job_retention_hours: int = 24

    # CORS
    cors_origins: list[str] = ["http://localhost:3001"]

    # Optional API key guard for API endpoints
    api_key: str | None = None

    # Google auth
    google_client_id: str | None = None
    auth_allowed_emails: list[str] = []
    auth_allowed_domains: list[str] = []
    session_secret: str | None = None
    session_max_age_seconds: int = 60 * 60 * 24 * 7

    # Vertex AI (for Gemini analysis)
    vertex_ai_location: str = "us-central1"

    model_config = {
        "env_file": Path(__file__).resolve().parent.parent / ".env",
        "case_sensitive": False,
    }


@lru_cache()
def get_settings() -> Settings:
    return Settings()

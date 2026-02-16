from functools import lru_cache
from pathlib import Path
from typing import Any
import json

from pydantic_settings import BaseSettings
from pydantic import field_validator


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
    max_pages_per_request: int = 30

    # Job management
    job_retention_hours: int = 24

    # CORS
    cors_origins_raw: str = "http://localhost:3001"

    # Optional API key guard for API endpoints
    api_key: str | None = None

    # Google auth
    google_client_id: str | None = None
    auth_allowed_emails_raw: str = ""
    auth_allowed_domains_raw: str = ""
    session_secret: str | None = None
    session_max_age_seconds: int = 60 * 60 * 24 * 7

    # Vertex AI (for Gemini analysis)
    vertex_ai_location: str = "us-central1"

    def _parse_list(self, v: str) -> list[str]:
        if not v.strip():
            return []
        # Try to parse as JSON first (handles ["a", "b"])
        if v.strip().startswith("[") and v.strip().endswith("]"):
            try:
                result = json.loads(v)
                if isinstance(result, list):
                    return [str(x) for x in result]
            except json.JSONDecodeError:
                pass
        # Fallback to comma-separated string
        return [s.strip() for s in v.split(",") if s.strip()]

    @property
    def auth_allowed_emails(self) -> list[str]:
        return self._parse_list(self.auth_allowed_emails_raw)

    @property
    def auth_allowed_domains(self) -> list[str]:
        return self._parse_list(self.auth_allowed_domains_raw)

    @property
    def cors_origins(self) -> list[str]:
        return self._parse_list(self.cors_origins_raw)

    model_config = {
        "env_file": Path(__file__).resolve().parent.parent / ".env",
        "case_sensitive": False,
        "extra": "ignore",
    }


@lru_cache()
def get_settings() -> Settings:
    return Settings()

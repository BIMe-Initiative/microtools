import logging
from datetime import timedelta
from typing import BinaryIO

from google.api_core import exceptions
from google.auth.transport.requests import Request
from google.cloud import storage

logger = logging.getLogger(__name__)


class GCSStorage:
    def __init__(self, bucket_name: str):
        self.client = storage.Client()
        self.bucket = self.client.bucket(bucket_name)

    def upload_file(
        self,
        file_content: BinaryIO,
        destination_path: str,
        content_type: str = "application/pdf",
    ) -> str:
        """Upload file to GCS. Returns gs:// URI."""
        blob = self.bucket.blob(destination_path)
        blob.upload_from_file(file_content, content_type=content_type)
        return f"gs://{self.bucket.name}/{destination_path}"

    def upload_bytes(
        self, content: bytes, destination_path: str, content_type: str
    ) -> str:
        """Upload bytes to GCS. Returns gs:// URI."""
        blob = self.bucket.blob(destination_path)
        blob.upload_from_string(content, content_type=content_type)
        return f"gs://{self.bucket.name}/{destination_path}"

    def download_as_bytes(self, source_path: str) -> bytes:
        """Download file from GCS as bytes."""
        blob = self.bucket.blob(source_path)
        return blob.download_as_bytes()

    def generate_signed_url(
        self, path: str, expiration_minutes: int = 60
    ) -> str:
        """Generate a signed HTTPS URL for temporary access."""
        blob = self.bucket.blob(path)
        expiration = timedelta(minutes=expiration_minutes)
        try:
            return blob.generate_signed_url(
                version="v4",
                expiration=expiration,
                method="GET",
            )
        except Exception as exc:
            # Cloud Run uses token-only credentials by default. Fallback to
            # IAM-based signing using the runtime service account access token.
            if "private key" not in str(exc).lower():
                raise

            creds = self.client._credentials
            if not getattr(creds, "token", None):
                creds.refresh(Request())

            service_account_email = getattr(creds, "service_account_email", None)
            if not service_account_email:
                raise

            return blob.generate_signed_url(
                version="v4",
                expiration=expiration,
                method="GET",
                service_account_email=service_account_email,
                access_token=creds.token,
            )

    def delete_file(self, path: str) -> bool:
        """Delete a file from GCS."""
        try:
            blob = self.bucket.blob(path)
            blob.delete()
            return True
        except exceptions.NotFound:
            logger.warning(f"File not found for deletion: {path}")
            return False

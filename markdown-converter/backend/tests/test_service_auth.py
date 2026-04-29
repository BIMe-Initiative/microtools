import os
import unittest
from datetime import datetime

from fastapi import HTTPException
from itsdangerous import URLSafeTimedSerializer
from starlette.requests import Request

os.environ.setdefault("GCP_PROJECT_ID", "test-project")
os.environ.setdefault("GCS_BUCKET_NAME", "test-bucket")

from backend import main  # noqa: E402
from backend.models import AuthUser, JobRecord, JobStatus  # noqa: E402


def _request_with_session(session_cookie: str | None = None) -> Request:
    headers = []
    if session_cookie:
        headers.append((b"cookie", f"session={session_cookie}".encode("utf-8")))
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": headers,
        }
    )


class ServiceAuthTests(unittest.TestCase):
    def setUp(self) -> None:
        self.previous_api_key = main.settings.api_key
        self.previous_service_account_email = main.settings.service_account_email
        self.previous_google_client_id = main.settings.google_client_id
        self.previous_session_serializer = main.session_serializer

        main.settings.api_key = "test-api-key"
        main.settings.service_account_email = "service:mad-evidence"
        main.settings.google_client_id = "test-google-client"
        main.session_serializer = URLSafeTimedSerializer("test-session-secret")

    def tearDown(self) -> None:
        main.settings.api_key = self.previous_api_key
        main.settings.service_account_email = self.previous_service_account_email
        main.settings.google_client_id = self.previous_google_client_id
        main.session_serializer = self.previous_session_serializer

    def test_valid_api_key_loads_service_actor_without_session(self) -> None:
        actor = main._load_request_actor(_request_with_session(), "test-api-key")

        self.assertEqual(actor.email, "service:mad-evidence")

    def test_invalid_api_key_fails_even_without_session_lookup(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            main._load_request_actor(_request_with_session(), "wrong-key")

        self.assertEqual(raised.exception.status_code, 401)

    def test_missing_session_and_api_key_fails_unauthorized(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            main._load_request_actor(_request_with_session(), None)

        self.assertEqual(raised.exception.status_code, 401)

    def test_browser_session_still_loads_user_without_api_key(self) -> None:
        token = main.session_serializer.dumps(  # type: ignore[union-attr]
            AuthUser(email="user@example.com").model_dump()
        )

        actor = main._load_request_actor(_request_with_session(token), None)

        self.assertEqual(actor.email, "user@example.com")

    def test_service_auth_bypasses_job_owner_check(self) -> None:
        job = JobRecord(
            job_id="job-1",
            status=JobStatus.COMPLETED,
            original_filename="test.pdf",
            owner_email="someone@example.com",
            created_at=datetime.now(),
        )
        actor = AuthUser(email="service:mad-evidence")

        main._verify_job_access(job, actor, service_authenticated=True)

    def test_browser_auth_keeps_job_owner_check(self) -> None:
        job = JobRecord(
            job_id="job-1",
            status=JobStatus.COMPLETED,
            original_filename="test.pdf",
            owner_email="someone@example.com",
            created_at=datetime.now(),
        )
        actor = AuthUser(email="user@example.com")

        with self.assertRaises(HTTPException) as raised:
            main._verify_job_access(job, actor, service_authenticated=False)

        self.assertEqual(raised.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()

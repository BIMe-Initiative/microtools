import os
import unittest

from fastapi.testclient import TestClient

os.environ.setdefault("GCP_PROJECT_ID", "test-project")
os.environ.setdefault("GCS_BUCKET_NAME", "test-bucket")

from backend import main  # noqa: E402


class FakeStorage:
    def __init__(self):
        self.objects: dict[str, bytes] = {}

    def upload_file(
        self,
        file_obj,
        destination_path: str,
        content_type: str | None = None,
    ) -> str:
        self.objects[destination_path] = file_obj.read()
        return f"gs://test-bucket/{destination_path}"

    def upload_bytes(
        self,
        data: bytes,
        destination_path: str,
        content_type: str | None = None,
    ) -> str:
        self.objects[destination_path] = data
        return f"gs://test-bucket/{destination_path}"

    def download_as_bytes(self, source_path: str) -> bytes:
        return self.objects[source_path]

    def list_paths(self, prefix: str) -> list[str]:
        return [path for path in self.objects if path.startswith(prefix)]

    def generate_signed_url(self, source_path: str, expiration_minutes: int = 60) -> str:
        return f"https://signed.example/{source_path}"


class FakeOCRService:
    def validate_document_size(self, file_size_bytes: int) -> bool:
        return True

    async def process_document(
        self,
        document_url,
        job_record,
        on_progress=None,
        storage_client=None,
    ):
        job_record.total_pages = 1
        job_record.processed_pages = 1
        if on_progress:
            await on_progress(job_record)
        return {
            "pages": [
                {
                    "index": 0,
                    "markdown": "# Converted Evidence\n\nThis markdown came from the converter.",
                    "images": [],
                }
            ]
        }


class MadHttpAdapterContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.previous_api_key = main.settings.api_key
        self.previous_service_account_email = main.settings.service_account_email
        self.previous_upload_storage = main.upload_storage
        self.previous_results_storage = main.results_storage
        self.previous_ocr_service = main.ocr_service
        self.previous_jobs = dict(main.jobs)

        main.settings.api_key = "test-api-key"
        main.settings.service_account_email = "service:mad-evidence"
        storage = FakeStorage()
        main.upload_storage = storage
        main.results_storage = storage
        main.ocr_service = FakeOCRService()
        main.jobs.clear()
        self.client = TestClient(main.app)

    def tearDown(self) -> None:
        main.settings.api_key = self.previous_api_key
        main.settings.service_account_email = self.previous_service_account_email
        main.upload_storage = self.previous_upload_storage
        main.results_storage = self.previous_results_storage
        main.ocr_service = self.previous_ocr_service
        main.jobs.clear()
        main.jobs.update(self.previous_jobs)

    def test_upload_status_preview_download_contract_with_api_key(self) -> None:
        upload = self.client.post(
            "/api/upload",
            headers={"x-api-key": "test-api-key"},
            files={"file": ("evidence.pdf", b"%PDF-1.4\n%%EOF\n", "application/pdf")},
        )
        self.assertEqual(upload.status_code, 200)
        upload_body = upload.json()
        self.assertIn("job_id", upload_body)

        job_id = upload_body["job_id"]
        status = self.client.get(
            f"/api/status/{job_id}",
            headers={"x-api-key": "test-api-key"},
        )
        self.assertEqual(status.status_code, 200)
        status_body = status.json()
        self.assertEqual(status_body["status"], "completed")
        self.assertIn("error", status_body)

        preview = self.client.get(
            f"/api/preview/{job_id}",
            headers={"x-api-key": "test-api-key"},
        )
        self.assertEqual(preview.status_code, 200)
        preview_body = preview.json()
        self.assertTrue(preview_body["markdown"].strip())
        self.assertIn("Converted Evidence", preview_body["markdown"])

        download = self.client.get(
            f"/api/download/{job_id}",
            headers={"x-api-key": "test-api-key"},
        )
        self.assertEqual(download.status_code, 200)
        self.assertEqual(download.headers["content-type"], "application/zip")
        self.assertIn("attachment;", download.headers["content-disposition"])
        self.assertGreater(len(download.content), 0)

        history = self.client.get(
            "/api/jobs",
            headers={"x-api-key": "test-api-key"},
        )
        self.assertEqual(history.status_code, 200)
        history_body = history.json()
        self.assertEqual(len(history_body["jobs"]), 1)
        self.assertEqual(history_body["jobs"][0]["job_id"], job_id)
        self.assertEqual(history_body["jobs"][0]["file_type"], "PDF")
        self.assertEqual(history_body["jobs"][0]["original_file_size"], 15)
        self.assertTrue(history_body["jobs"][0]["source_available"])
        self.assertTrue(history_body["jobs"][0]["markdown_available"])

        source = self.client.get(
            f"/api/source/{job_id}",
            headers={"x-api-key": "test-api-key"},
        )
        self.assertEqual(source.status_code, 200)
        self.assertEqual(source.content, b"%PDF-1.4\n%%EOF\n")
        self.assertIn("evidence.pdf", source.headers["content-disposition"])

        markdown = self.client.get(
            f"/api/output/{job_id}",
            headers={"x-api-key": "test-api-key"},
        )
        self.assertEqual(markdown.status_code, 200)
        self.assertEqual(markdown.headers["content-type"], "text/markdown; charset=utf-8")
        self.assertIn("Converted Evidence", markdown.text)

    def test_missing_or_invalid_api_key_is_not_public(self) -> None:
        missing = self.client.post(
            "/api/upload",
            files={"file": ("evidence.pdf", b"%PDF-1.4\n%%EOF\n", "application/pdf")},
        )
        self.assertEqual(missing.status_code, 401)

        invalid = self.client.post(
            "/api/upload",
            headers={"x-api-key": "wrong-key"},
            files={"file": ("evidence.pdf", b"%PDF-1.4\n%%EOF\n", "application/pdf")},
        )
        self.assertEqual(invalid.status_code, 401)

    def test_image_annotations_are_controlled_by_upload_query_param(self) -> None:
        default_upload = self.client.post(
            "/api/upload",
            headers={"x-api-key": "test-api-key"},
            files={"file": ("default.pdf", b"%PDF-1.4\n%%EOF\n", "application/pdf")},
        )
        self.assertEqual(default_upload.status_code, 200)
        default_job = main.jobs[default_upload.json()["job_id"]]
        self.assertFalse(default_job.image_annotations)

        enabled = self.client.post(
            "/api/upload?image_annotations=true",
            headers={"x-api-key": "test-api-key"},
            files={"file": ("enabled.pdf", b"%PDF-1.4\n%%EOF\n", "application/pdf")},
        )
        self.assertEqual(enabled.status_code, 200)
        enabled_job = main.jobs[enabled.json()["job_id"]]
        self.assertTrue(enabled_job.image_annotations)


if __name__ == "__main__":
    unittest.main()

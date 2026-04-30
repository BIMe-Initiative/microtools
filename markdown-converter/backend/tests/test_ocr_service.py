import json
import unittest
from types import SimpleNamespace

from backend.ocr_service import MistralOCRService


class CapturingOCR:
    def __init__(self) -> None:
        self.kwargs = None

    def process(self, **kwargs):
        self.kwargs = kwargs
        return SimpleNamespace(pages=[])


class CapturingClient:
    def __init__(self) -> None:
        self.ocr = CapturingOCR()


class MistralOCRSerializationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = MistralOCRService(settings=SimpleNamespace())

    def test_dict_image_annotation_is_preserved(self) -> None:
        annotation = {
            "image_type": "chart",
            "short_description": "Chart showing quarterly revenue.",
            "flow_steps": [],
            "key_labels": ["Q1", "Q2"],
            "confidence": "high",
        }
        page = {
            "index": 0,
            "markdown": "![Chart](img-0.png)",
            "images": [
                {
                    "id": "img-0.png",
                    "image_base64": "abc",
                    "annotation": annotation,
                }
            ],
        }

        serialized = self.service._serialize_page(page)

        self.assertEqual(serialized["images"][0]["annotation"], annotation)

    def test_object_image_annotation_json_is_preserved(self) -> None:
        annotation = {
            "image_type": "flowchart",
            "short_description": "Flowchart showing request review.",
            "flow_steps": ["Submit", "Review"],
            "key_labels": ["Submit", "Review"],
            "confidence": "medium",
        }
        image = SimpleNamespace(
            id="img-1.png",
            image_base64="abc",
            image_annotation=json.dumps(annotation),
        )
        page = SimpleNamespace(index=1, markdown="![Flow](img-1.png)", images=[image])

        serialized = self.service._serialize_page(page)

        self.assertEqual(serialized["images"][0]["annotation"], annotation)

    def test_object_bbox_annotation_is_preserved(self) -> None:
        annotation = {
            "image_type": "screenshot",
            "short_description": "Screenshot of a settings page.",
            "flow_steps": [],
            "key_labels": ["Settings"],
            "confidence": "low",
        }
        image = SimpleNamespace(
            id="img-2.png",
            image_base64="abc",
            bbox_annotation=annotation,
        )
        page = SimpleNamespace(index=2, markdown="![Screen](img-2.png)", images=[image])

        serialized = self.service._serialize_page(page)

        self.assertEqual(serialized["images"][0]["annotation"], annotation)

    def test_missing_annotation_does_not_emit_annotation_key(self) -> None:
        page = {
            "index": 0,
            "markdown": "![Image](img-0.png)",
            "images": [{"id": "img-0.png", "image_base64": "abc"}],
        }

        serialized = self.service._serialize_page(page)

        self.assertNotIn("annotation", serialized["images"][0])


class MistralOCRRequestTests(unittest.TestCase):
    def _service(self) -> MistralOCRService:
        return MistralOCRService(
            settings=SimpleNamespace(
                mistral_model="mistral-ocr-2505",
                image_annotation_min_size=96,
                image_annotation_limit=3,
            )
        )

    def test_enabled_sdk_request_includes_bbox_annotation_format(self) -> None:
        service = self._service()
        client = CapturingClient()
        service._client = client

        service._process_ocr_batch(
            "https://signed.example/doc.pdf",
            [0, 2],
            image_annotations=True,
        )

        request = client.ocr.kwargs
        self.assertEqual(request["model"], "mistral-ocr-2505")
        self.assertEqual(
            request["document"],
            {
                "type": "document_url",
                "document_url": "https://signed.example/doc.pdf",
            },
        )
        self.assertTrue(request["include_image_base64"])
        self.assertEqual(request["pages"], [0, 2])
        self.assertEqual(request["image_min_size"], 96)
        self.assertEqual(request["image_limit"], 3)
        self.assertEqual(request["bbox_annotation_format"]["type"], "json_schema")

    def test_disabled_sdk_request_keeps_existing_payload_shape(self) -> None:
        service = self._service()
        client = CapturingClient()
        service._client = client

        service._process_ocr_batch(
            "https://signed.example/doc.pdf",
            [0],
            image_annotations=False,
        )

        request = client.ocr.kwargs
        self.assertNotIn("bbox_annotation_format", request)
        self.assertNotIn("image_min_size", request)
        self.assertNotIn("image_limit", request)

    def test_raw_predict_path_disables_annotations(self) -> None:
        service = self._service()
        service._client = SimpleNamespace()
        captured = {}

        def fake_raw_predict(document_url, page_indices):
            captured["document_url"] = document_url
            captured["page_indices"] = page_indices
            return SimpleNamespace(pages=[])

        service._process_ocr_via_raw_predict = fake_raw_predict

        service._process_ocr_batch(
            "https://signed.example/doc.pdf",
            [1],
            image_annotations=True,
        )

        self.assertEqual(
            captured,
            {
                "document_url": "https://signed.example/doc.pdf",
                "page_indices": [1],
            },
        )


if __name__ == "__main__":
    unittest.main()

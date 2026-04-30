import unittest

from backend.formatter import ObsidianMarkdownFormatter


PNG_DATA_URI = "data:image/png;base64,Zm9v"


class ObsidianMarkdownFormatterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.formatter = ObsidianMarkdownFormatter()

    def test_uses_flat_obsidian_embed_with_saved_filename(self) -> None:
        ocr_result = {
            "pages": [
                {
                    "index": 1,
                    "markdown": "![img-0.jpeg](img-0.jpeg)",
                    "images": [
                        {"id": "img-0.jpeg", "image_base64": PNG_DATA_URI},
                    ],
                }
            ]
        }

        markdown, attachments = self.formatter.format_document(
            ocr_result, "Macro-BIM Adoption, Conceptual Structures.pdf"
        )

        expected_name = "Macro-BIM Adoption, Conceptual Structures_p2_img-0.png"
        self.assertIn(f"![[{expected_name}]]", markdown)
        self.assertNotIn(".jpeg.png", markdown)
        self.assertIn(expected_name, attachments)
        self.assertNotIn(f"attachments/{expected_name}", markdown)

    def test_replaces_wrapped_link_with_flat_embed(self) -> None:
        ocr_result = {
            "pages": [
                {
                    "index": 0,
                    "markdown": '[Alt Text](attachments/img-0.jpeg "Caption")',
                    "images": [
                        {"id": "img-0.jpeg", "image_base64": PNG_DATA_URI},
                    ],
                }
            ]
        }

        markdown, attachments = self.formatter.format_document(
            ocr_result, "Doc.pdf"
        )

        expected_name = "Doc_p1_img-0.png"
        self.assertIn(f"![[{expected_name}]]", markdown)
        self.assertIn(expected_name, attachments)
        self.assertNotIn("[Alt Text](", markdown)
        self.assertNotIn("![[![[", markdown)

    def test_replaces_nested_wikilink_with_single_embed(self) -> None:
        ocr_result = {
            "pages": [
                {
                    "index": 2,
                    "markdown": (
                        "![[Macro-BIM Adoption, Conceptual Structures_p3_"
                        "![[Macro-BIM Adoption, Conceptual Structures_p3_img-1.jpeg.png]].png]]"
                    ),
                    "images": [
                        {
                            "id": "Macro-BIM Adoption, Conceptual Structures_p3_img-1.jpeg.png",
                            "image_base64": PNG_DATA_URI,
                        },
                    ],
                }
            ]
        }

        markdown, attachments = self.formatter.format_document(
            ocr_result, "Macro-BIM Adoption, Conceptual Structures.pdf"
        )

        expected_name = "Macro-BIM Adoption, Conceptual Structures_p3_img-1.png"
        self.assertIn(f"![[{expected_name}]]", markdown)
        self.assertNotIn(".jpeg.png", markdown)
        self.assertNotIn("![[![[", markdown)
        self.assertIn(expected_name, attachments)

    def test_image_annotation_inserts_callout_below_embed(self) -> None:
        ocr_result = {
            "pages": [
                {
                    "index": 0,
                    "markdown": "![Figure](img-0.jpeg)",
                    "images": [
                        {
                            "id": "img-0.jpeg",
                            "image_base64": PNG_DATA_URI,
                            "annotation": {
                                "image_type": "chart",
                                "short_description": "Bar chart comparing quarterly revenue by region",
                                "flow_steps": [],
                                "key_labels": ["Q1", "Q2", "APAC"],
                                "confidence": "high",
                            },
                        },
                    ],
                }
            ]
        }

        markdown, attachments = self.formatter.format_document(ocr_result, "Doc.pdf")

        expected_name = "Doc_p1_img-0.png"
        self.assertIn(expected_name, attachments)
        self.assertIn(
            f"![[{expected_name}]]\n\n"
            "> [!note] Image description\n"
            "> Bar chart comparing quarterly revenue by region.\n"
            ">\n"
            "> Labels: Q1; Q2; APAC.",
            markdown,
        )

    def test_flow_steps_and_labels_are_rendered_compactly(self) -> None:
        ocr_result = {
            "pages": [
                {
                    "index": 0,
                    "markdown": "![Flow](img-0.jpeg)",
                    "images": [
                        {
                            "id": "img-0.jpeg",
                            "image_base64": PNG_DATA_URI,
                            "annotation": {
                                "image_type": "flowchart",
                                "short_description": "Flowchart showing request handling from intake to notification",
                                "flow_steps": [
                                    "Submit request",
                                    "Validate details",
                                    "Approve or reject",
                                ],
                                "key_labels": ["Submit", "Validate", "Notify"],
                                "confidence": "medium",
                            },
                        },
                    ],
                }
            ]
        }

        markdown, _ = self.formatter.format_document(ocr_result, "Doc.pdf")

        self.assertIn(
            "> Steps: Submit request; Validate details; Approve or reject.",
            markdown,
        )
        self.assertIn("> Labels: Submit; Validate; Notify.", markdown)

    def test_decorative_or_malformed_annotations_do_not_break_formatting(self) -> None:
        ocr_result = {
            "pages": [
                {
                    "index": 0,
                    "markdown": "![Decorative](decor.jpeg)\n\n![Malformed](bad.jpeg)",
                    "images": [
                        {
                            "id": "decor.jpeg",
                            "image_base64": PNG_DATA_URI,
                            "annotation": {
                                "image_type": "decorative",
                                "short_description": "Small dividing flourish",
                                "flow_steps": [],
                                "key_labels": [],
                                "confidence": "high",
                            },
                        },
                        {
                            "id": "bad.jpeg",
                            "image_base64": PNG_DATA_URI,
                            "annotation": "not a dict",
                        },
                    ],
                }
            ]
        }

        markdown, attachments = self.formatter.format_document(ocr_result, "Doc.pdf")

        self.assertIn("![[Doc_p1_decor.png]]", markdown)
        self.assertIn("![[Doc_p1_bad.png]]", markdown)
        self.assertNotIn("Image description", markdown)
        self.assertEqual(set(attachments), {"Doc_p1_decor.png", "Doc_p1_bad.png"})

    def test_duplicate_image_reference_gets_one_annotation(self) -> None:
        ocr_result = {
            "pages": [
                {
                    "index": 0,
                    "markdown": "![Figure](img-0.jpeg)\n\n![Figure again](img-0.jpeg)",
                    "images": [
                        {
                            "id": "img-0.jpeg",
                            "image_base64": PNG_DATA_URI,
                            "annotation": {
                                "image_type": "screenshot",
                                "short_description": "Screenshot of a settings page",
                                "flow_steps": [],
                                "key_labels": ["Settings"],
                                "confidence": "low",
                            },
                        },
                    ],
                }
            ]
        }

        markdown, _ = self.formatter.format_document(ocr_result, "Doc.pdf")

        self.assertEqual(markdown.count("> [!note] Image description"), 1)
        self.assertIn(
            "> Low-confidence description: Screenshot of a settings page.",
            markdown,
        )

    def test_annotation_preserves_text_after_inline_image_reference(self) -> None:
        ocr_result = {
            "pages": [
                {
                    "index": 0,
                    "markdown": "![Figure](img-0.jpeg) caption text",
                    "images": [
                        {
                            "id": "img-0.jpeg",
                            "image_base64": PNG_DATA_URI,
                            "annotation": {
                                "image_type": "chart",
                                "short_description": "Chart showing quarterly revenue",
                                "flow_steps": [],
                                "key_labels": [],
                                "confidence": "high",
                            },
                        },
                    ],
                }
            ]
        }

        markdown, _ = self.formatter.format_document(ocr_result, "Doc.pdf")

        self.assertIn(
            "![[Doc_p1_img-0.png]]\n\n"
            "> [!note] Image description\n"
            "> Chart showing quarterly revenue.\n\n"
            "caption text",
            markdown,
        )


if __name__ == "__main__":
    unittest.main()

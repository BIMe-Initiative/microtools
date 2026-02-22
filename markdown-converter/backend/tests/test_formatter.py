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


if __name__ == "__main__":
    unittest.main()

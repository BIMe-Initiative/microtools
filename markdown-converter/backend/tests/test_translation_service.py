import unittest

from backend.translation_service import MarkdownTranslationService


class FakeMarkdownTranslationService(MarkdownTranslationService):
    def __init__(self):
        super().__init__(settings=object())
        self.requests: list[list[str]] = []

    async def _translate_batch(self, texts, source_language, target_language):
        self.requests.append(texts)
        translations = []
        for text in texts:
            translations.append(
                text.replace("Titulo", "Title")
                .replace("Este parrafo", "This paragraph")
                .replace("con enlace", "with link")
                .replace("Primeiro item", "First item")
                .replace("Valor", "Value")
                .replace("Celula", "Cell")
            )
        return translations, ["pt"] * len(texts)


class MarkdownTranslationServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_translates_markdown_body_while_preserving_structure(self) -> None:
        service = FakeMarkdownTranslationService()
        source = """---
id: test
type: Content
---

# Titulo

Este parrafo con enlace [BIM](https://example.com) e `codigo`.

- Primeiro item

| Campo | Valor |
| --- | --- |
| Celula | ![[Doc_p1_img-0.png]] |

```ts
const label = "Titulo";
```
"""

        result = await service.translate_markdown(source, source_language="auto")

        self.assertEqual(result.detected_source_language, "pt")
        self.assertIn("id: test", result.markdown)
        self.assertIn("# Title", result.markdown)
        self.assertIn("This paragraph with link [BIM](https://example.com) e `codigo`.", result.markdown)
        self.assertIn("- First item", result.markdown)
        self.assertIn("| Campo | Value |", result.markdown)
        self.assertIn("| Cell | ![[Doc_p1_img-0.png]] |", result.markdown)
        self.assertIn('const label = "Titulo";', result.markdown)

    async def test_explicit_english_source_skips_api_call(self) -> None:
        service = FakeMarkdownTranslationService()

        result = await service.translate_markdown("# Already English", source_language="en")

        self.assertEqual(result.markdown, "# Already English")
        self.assertEqual(result.translated_segments, 0)
        self.assertEqual(service.requests, [])


if __name__ == "__main__":
    unittest.main()

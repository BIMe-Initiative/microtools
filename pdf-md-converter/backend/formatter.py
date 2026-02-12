import base64
import io
import logging
import re
import zipfile
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)


class ObsidianMarkdownFormatter:
    """Convert Mistral OCR response to Obsidian-compatible markdown."""

    def format_document(
        self, ocr_result: dict, original_filename: str
    ) -> tuple[str, dict[str, bytes]]:
        """
        Convert OCR result to Obsidian markdown with attachments.

        Returns:
            (markdown_content, attachments_dict)
            where attachments_dict maps image filenames to PNG bytes.
        """
        stem = Path(original_filename).stem
        frontmatter = self._generate_frontmatter(stem)

        markdown_parts: list[str] = []
        attachments: dict[str, bytes] = {}

        for page in ocr_result.get("pages", []):
            page_num = page["index"] + 1

            if page_num > 1:
                markdown_parts.append("\n---\n")

            page_md = page.get("markdown", "")

            # Process images: decode base64, create attachment files,
            # replace references with Obsidian wikilinks
            for img in page.get("images", []):
                img_id = img["id"]
                img_b64 = img.get("image_base64", "")
                if not img_b64:
                    continue

                img_filename = f"{stem}_p{page_num}_{img_id}.png"

                # Strip data URI prefix if present
                if "," in img_b64 and img_b64.startswith("data:"):
                    img_b64 = img_b64.split(",", 1)[1]

                try:
                    attachments[img_filename] = base64.b64decode(img_b64)
                except Exception:
                    logger.warning(
                        f"Failed to decode image {img_id} on page {page_num}"
                    )
                    continue

                wikilink = f"![[{img_filename}]]"

                # Replace standard markdown image references
                page_md = re.sub(
                    rf"!\[.*?\]\({re.escape(img_id)}\)", wikilink, page_md
                )
                # Replace bare image ID references
                page_md = page_md.replace(img_id, wikilink)

            markdown_parts.append(page_md)

        full_markdown = frontmatter + "\n\n" + "\n\n".join(markdown_parts)
        return full_markdown, attachments

    def _generate_frontmatter(self, title: str) -> str:
        now = datetime.now()
        return (
            "---\n"
            f"title: \"{title}\"\n"
            f"date: {now.strftime('%Y-%m-%d')}\n"
            "source: PDF Conversion (Mistral OCR)\n"
            "tags:\n"
            "  - pdf\n"
            "  - imported\n"
            f"created: {now.isoformat()}\n"
            "---"
        )

    def create_zip_archive(
        self,
        markdown_content: str,
        attachments: dict[str, bytes],
        base_filename: str,
    ) -> bytes:
        """
        Create a zip containing the .md file and an attachments/ folder.

        Structure:
            base_filename.md
            attachments/
                image1.png
                image2.png
        """
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr(
                f"{base_filename}.md", markdown_content.encode("utf-8")
            )
            for img_name, img_bytes in attachments.items():
                zf.writestr(f"attachments/{img_name}", img_bytes)
        buf.seek(0)
        return buf.read()

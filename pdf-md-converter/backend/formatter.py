import base64
import io
import logging
import re
import zipfile
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote

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

                img_filename = self._build_image_filename(stem, page_num, img_id, img_b64)

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

                # Replace markdown image or link references to this image with a flat
                # Obsidian embed, e.g. ![[filename.png]].
                page_md = self._replace_image_references(page_md, img_id, wikilink)

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

    def _build_image_filename(
        self, stem: str, page_num: int, image_id: str, image_base64: str
    ) -> str:
        base_name = Path(self._strip_query_and_fragment(image_id)).name
        clean_id = self._strip_known_image_extensions(base_name) or "image"
        ext = self._extension_from_base64(image_base64) or ".png"
        return f"{stem}_p{page_num}_{clean_id}{ext}"

    def _replace_image_references(
        self, page_md: str, image_id: str, wikilink: str
    ) -> str:
        targets = self._reference_targets(image_id)
        if not targets:
            return page_md

        pattern = re.compile(r"(!?)\[[^\]]*\]\(([^)]+)\)")

        def _replace(match: re.Match[str]) -> str:
            target = self._normalize_link_target(match.group(2))
            if target in targets:
                return wikilink
            return match.group(0)

        return pattern.sub(_replace, page_md)

    def _reference_targets(self, image_id: str) -> set[str]:
        normalized_id = self._normalize_reference(image_id)
        basename = Path(self._strip_query_and_fragment(image_id)).name
        normalized_basename = self._normalize_reference(basename)
        stemmed_basename = self._normalize_reference(
            self._strip_known_image_extensions(basename)
        )
        return {
            value
            for value in [normalized_id, normalized_basename, stemmed_basename]
            if value
        }

    def _normalize_link_target(self, raw_target: str) -> str:
        target = raw_target.strip()
        if target.startswith("<") and target.endswith(">"):
            target = target[1:-1].strip()
        # Strip optional markdown link title, e.g. (img.png "caption")
        if " " in target:
            target = target.split(" ", 1)[0].strip()
        return self._normalize_reference(target)

    def _normalize_reference(self, value: str) -> str:
        if not value:
            return ""
        normalized = unquote(value.strip().strip("'\""))
        normalized = self._strip_query_and_fragment(normalized)
        normalized = normalized.replace("\\", "/")
        normalized = Path(normalized).name
        return normalized.lower()

    def _strip_query_and_fragment(self, value: str) -> str:
        return value.split("#", 1)[0].split("?", 1)[0]

    def _strip_known_image_extensions(self, value: str) -> str:
        if not value:
            return value
        suffixes = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"}
        base = value
        while True:
            suffix = Path(base).suffix.lower()
            if suffix in suffixes:
                base = base[: -len(suffix)]
                continue
            break
        return base

    def _extension_from_base64(self, image_base64: str) -> str | None:
        if not image_base64.startswith("data:"):
            return None
        header = image_base64.split(",", 1)[0].lower()
        if "image/png" in header:
            return ".png"
        if "image/jpeg" in header or "image/jpg" in header:
            return ".jpeg"
        if "image/webp" in header:
            return ".webp"
        if "image/gif" in header:
            return ".gif"
        if "image/bmp" in header:
            return ".bmp"
        if "image/tiff" in header:
            return ".tiff"
        return None

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

import base64
import hashlib
import io
import logging
import re
import zipfile
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote
from .models import JobRecord

logger = logging.getLogger(__name__)


class ObsidianMarkdownFormatter:
    """Convert Mistral OCR response to Obsidian-compatible markdown."""

    def format_document(
        self, ocr_result: dict, job: JobRecord
    ) -> tuple[str, dict[str, bytes]]:
        """
        Convert OCR result to Obsidian markdown with attachments.

        Returns:
            (markdown_content, attachments_dict)
            where attachments_dict maps image filenames to PNG bytes.
        """
        original_filename = job.original_filename
        stem = Path(original_filename).stem
        
        pages = ocr_result.get("pages", [])
        granularity = "Complex" if len(pages) > 1 else "Compound"
        
        frontmatter = self._generate_frontmatter(job, granularity)

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

    def _slugify(self, text: str) -> str:
        """Create a URL-safe slug from text."""
        text = text.lower()
        text = re.sub(r"[^\w\s-]", "", text)
        text = re.sub(r"[\s_-]+", "-", text)
        return text.strip("-")

    def _generate_id(self, filename: str, job_id: str) -> str:
        """
        Generate a stable, unique ID for the conversion.
        Format: BIMei-content-<slugified_filename>-<hash>
        """
        slug = self._slugify(Path(filename).stem)
        # Use first 4 hex digits of SHA-256 hash of job_id for uniqueness
        salt = hashlib.sha256(job_id.encode()).hexdigest()[:4]
        return f"BIMei-content-{slug}-{salt}"

    def _generate_frontmatter(self, job: JobRecord, granularity: str) -> str:
        now = datetime.now()
        iso_now = now.isoformat(timespec='seconds')
        
        # ID generation
        unique_id = self._generate_id(job.original_filename, job.job_id)
        
        # Vault Mode overrides or defaults
        type_val = job.kos_type if (job.vault_mode and job.kos_type) else "Content"
        subtype_val = job.kos_subtype if (job.vault_mode and job.kos_subtype) else "Report"
        use_scope_val = job.kos_use_scope if (job.vault_mode and job.kos_use_scope) else "All"
        access_level_val = job.kos_access_level if (job.vault_mode and job.kos_access_level) else "open"
        export_targets_val = job.kos_export_targets if (job.vault_mode and job.kos_export_targets) else []
        
        # Formatting export_targets as valid YAML list
        export_targets_str = f"[{', '.join(export_targets_val)}]" if export_targets_val else "[]"

        return (
            "---\n"
            f"id: {unique_id}\n"
            f"type: {type_val}\n"
            f"subtype: {subtype_val}\n"
            "status: draft\n"
            "version: 0.1.0\n\n"
            f"created: {job.created_at.isoformat(timespec='seconds')}\n"
            f"updated: {iso_now}\n\n"
            f"use_scope: {use_scope_val}\n"
            f"access_level: {access_level_val}\n"
            f"export_targets: {export_targets_str}\n\n"
            f"granularity: {granularity}\n\n"
            "provenance:\n"
            "  source_type: ocr\n"
            f"  source_ref: {job.original_filename}\n"
            "  source_date: null\n\n"
            "tags:\n"
            "  - pdf\n"
            "  - imported\n"
            "---"
        )

    def _build_image_filename(
        self, stem: str, page_num: int, image_id: str, image_base64: str
    ) -> str:
        normalized_id = self._extract_reference_core(image_id)
        base_name = Path(self._strip_query_and_fragment(normalized_id)).name
        clean_id = self._strip_known_image_extensions(base_name) or "image"
        clean_id = re.sub(r"[^\w\-. ]+", "", clean_id).strip() or "image"
        # Always normalize output image naming to .png for Obsidian attachments.
        if clean_id.lower().endswith(".png"):
            clean_id = clean_id[:-4]
        page_marker = f"_p{page_num}_"
        if page_marker in clean_id:
            tail = clean_id.split(page_marker, 1)[1].strip()
            if tail:
                return f"{stem}_p{page_num}_{tail}.png"
        page_prefix = f"{stem}_p{page_num}_"
        if clean_id.startswith(page_prefix):
            return f"{clean_id}.png"
        return f"{page_prefix}{clean_id}.png"

    def _replace_image_references(
        self, page_md: str, image_id: str, wikilink: str
    ) -> str:
        targets = self._reference_targets(image_id)
        if not targets:
            return page_md

        md_link_pattern = re.compile(r"(!?)\[[^\]]*\]\(([^)]+)\)")
        wiki_link_pattern = re.compile(r"(!?)\[\[([^\]]+)\]\]")

        def _matches_target(target: str) -> bool:
            if target in targets:
                return True
            return any(t in target for t in targets)

        def _replace_md_link(match: re.Match[str]) -> str:
            target = self._normalize_link_target(match.group(2))
            if _matches_target(target):
                return wikilink
            return match.group(0)

        def _replace_wikilink(match: re.Match[str]) -> str:
            target = self._normalize_reference(self._extract_reference_core(match.group(2)))
            if _matches_target(target):
                return wikilink
            return match.group(0)

        page_md = md_link_pattern.sub(_replace_md_link, page_md)
        page_md = wiki_link_pattern.sub(_replace_wikilink, page_md)
        # If a malformed nested wikilink leaves trailing outer wrapper text,
        # collapse it back to the resolved single wikilink.
        page_md = re.sub(
            rf"{re.escape(wikilink)}[^\n\[]*\]\]",
            wikilink,
            page_md,
        )
        return page_md

    def _reference_targets(self, image_id: str) -> set[str]:
        core = self._extract_reference_core(image_id)
        normalized_id = self._normalize_reference(core)
        basename = Path(self._strip_query_and_fragment(core)).name
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

    def _extract_reference_core(self, value: str) -> str:
        if not value:
            return value
        raw = value.strip()
        matches = re.findall(r"!\[\[([^\]]+)\]\]", raw)
        if matches:
            raw = matches[-1]
        else:
            wiki_matches = re.findall(r"\[\[([^\]]+)\]\]", raw)
            if wiki_matches:
                raw = wiki_matches[-1]
        return raw

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

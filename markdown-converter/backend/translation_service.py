import re
import textwrap
from collections import Counter
from dataclasses import dataclass
from typing import Callable

import google.auth
import google.auth.transport.requests
import httpx

from .config import get_settings


@dataclass
class TranslationResult:
    markdown: str
    detected_source_language: str | None
    provider: str
    translated_segments: int


@dataclass
class _Segment:
    marker: str
    text: str
    replacements: dict[str, str]


class MarkdownTranslationService:
    """Translate Markdown prose while preserving structural Markdown tokens."""

    provider = "google-cloud-translation-v3"
    _token_pattern = re.compile(
        r"`[^`\n]+`"
        r"|!?\[\[[^\]\n]+\]\]"
        r"|!?\[[^\]\n]*\]\([^)]+\)"
        r"|https?://[^\s)]+"
        r"|<[^>\n]+>"
    )

    def __init__(self, settings=None):
        self._settings = settings or get_settings()

    async def translate_markdown(
        self,
        markdown: str,
        source_language: str | None = "auto",
        target_language: str = "en",
    ) -> TranslationResult:
        source = (source_language or "auto").strip().lower() or "auto"
        target = target_language.strip().lower() or "en"
        if source in {"en", "en-us", "en-gb", "en-au"} and target.startswith("en"):
            return TranslationResult(markdown, source, self.provider, 0)

        frontmatter, body = self._split_frontmatter(markdown)
        template, segments = self._extract_segments(body)
        if not segments:
            return TranslationResult(markdown, None, self.provider, 0)

        translated_texts, detected_languages = await self._translate_texts(
            [segment.text for segment in segments],
            source_language=source,
            target_language=target,
        )

        translated_body = template
        for segment, translated in zip(segments, translated_texts):
            restored = self._restore_tokens(translated, segment.replacements)
            translated_body = translated_body.replace(segment.marker, restored)

        detected = self._dominant_language(detected_languages)
        return TranslationResult(
            markdown=frontmatter + translated_body,
            detected_source_language=detected,
            provider=self.provider,
            translated_segments=len(segments),
        )

    async def _translate_texts(
        self,
        texts: list[str],
        source_language: str,
        target_language: str,
    ) -> tuple[list[str], list[str | None]]:
        translated: list[str] = []
        detected: list[str | None] = []
        for batch in self._batch_texts(texts):
            batch_translated, batch_detected = await self._translate_batch(
                batch,
                source_language=source_language,
                target_language=target_language,
            )
            translated.extend(batch_translated)
            detected.extend(batch_detected)
        return translated, detected

    async def _translate_batch(
        self,
        texts: list[str],
        source_language: str,
        target_language: str,
    ) -> tuple[list[str], list[str | None]]:
        project_id = (
            getattr(self._settings, "google_translate_project", None)
            or getattr(self._settings, "gcp_project_id", None)
        )
        if not project_id:
            raise RuntimeError("Translation service not configured: missing project ID")

        location = getattr(self._settings, "google_translate_location", "global")
        quota_project = (
            getattr(self._settings, "google_translate_quota_project", None)
            or project_id
        )
        token = self._access_token()
        url = (
            "https://translation.googleapis.com/v3/"
            f"projects/{project_id}/locations/{location}:translateText"
        )
        payload = {
            "contents": texts,
            "targetLanguageCode": target_language,
            "mimeType": "text/plain",
        }
        if source_language and source_language != "auto":
            payload["sourceLanguageCode"] = source_language

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "X-Goog-User-Project": quota_project,
        }

        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(url, json=payload, headers=headers)

        if response.status_code >= 400:
            message = self._google_error_message(response)
            raise RuntimeError(f"Cloud Translation failed ({response.status_code}): {message}")

        data = response.json()
        translations = data.get("translations") or []
        translated = [
            item.get("translatedText", "") if isinstance(item, dict) else ""
            for item in translations
        ]
        detected = [
            item.get("detectedLanguageCode") if isinstance(item, dict) else None
            for item in translations
        ]
        if len(translated) != len(texts):
            raise RuntimeError("Cloud Translation response did not match request size")
        return translated, detected

    def _access_token(self) -> str:
        credentials, _ = google.auth.default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        credentials.refresh(google.auth.transport.requests.Request())
        token = credentials.token
        if not token:
            raise RuntimeError("Translation service authentication failed")
        return token

    def _google_error_message(self, response: httpx.Response) -> str:
        try:
            payload = response.json()
        except Exception:
            return response.text
        error = payload.get("error") if isinstance(payload, dict) else None
        if isinstance(error, dict):
            return str(error.get("message") or error)
        return str(payload)

    def _split_frontmatter(self, markdown: str) -> tuple[str, str]:
        lines = markdown.splitlines(keepends=True)
        if not lines or lines[0].strip() != "---":
            return "", markdown
        for index in range(1, len(lines)):
            if lines[index].strip() == "---":
                return "".join(lines[: index + 1]), "".join(lines[index + 1 :])
        return "", markdown

    def _extract_segments(self, body: str) -> tuple[str, list[_Segment]]:
        segments: list[_Segment] = []

        def add_segment(text: str) -> str:
            return self._segment_text(text, segments)

        output: list[str] = []
        in_fence = False
        fence_marker = ""
        for raw_line in body.splitlines(keepends=True):
            line, newline = self._split_newline(raw_line)
            stripped = line.lstrip()
            fence = self._fence_marker(stripped)

            if in_fence:
                output.append(raw_line)
                if fence == fence_marker:
                    in_fence = False
                    fence_marker = ""
                continue

            if fence:
                in_fence = True
                fence_marker = fence
                output.append(raw_line)
                continue

            output.append(self._transform_line(line, add_segment) + newline)

        return "".join(output), segments

    def _split_newline(self, value: str) -> tuple[str, str]:
        if value.endswith("\r\n"):
            return value[:-2], "\r\n"
        if value.endswith("\n"):
            return value[:-1], "\n"
        return value, ""

    def _fence_marker(self, stripped_line: str) -> str:
        if stripped_line.startswith("```"):
            return "```"
        if stripped_line.startswith("~~~"):
            return "~~~"
        return ""

    def _transform_line(self, line: str, add_segment: Callable[[str], str]) -> str:
        stripped = line.strip()
        if not stripped or re.fullmatch(r"[-*_]{3,}", stripped):
            return line

        if "|" in line and self._looks_like_table_row(line):
            return self._transform_table_line(line, add_segment)

        heading = re.match(r"^(\s{0,3}#{1,6}\s+)(.+)$", line)
        if heading:
            return heading.group(1) + add_segment(heading.group(2))

        quote = re.match(r"^(\s*>+\s?)(.*)$", line)
        if quote:
            prefix, content = quote.groups()
            callout = re.match(r"^(\s*\[![^\]]+\]\s*)(.*)$", content)
            if callout:
                return prefix + callout.group(1) + add_segment(callout.group(2))
            return prefix + add_segment(content)

        list_item = re.match(
            r"^(\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)(.*)$",
            line,
        )
        if list_item:
            return list_item.group(1) + add_segment(list_item.group(2))

        return add_segment(line)

    def _looks_like_table_row(self, line: str) -> bool:
        stripped = line.strip()
        if "|" not in stripped:
            return False
        return stripped.startswith("|") or stripped.endswith("|") or stripped.count("|") >= 2

    def _is_table_separator(self, line: str) -> bool:
        cells = [cell.strip().replace(" ", "") for cell in line.strip().strip("|").split("|")]
        return bool(cells) and all(re.fullmatch(r":?-{3,}:?", cell or "") for cell in cells)

    def _transform_table_line(self, line: str, add_segment: Callable[[str], str]) -> str:
        if self._is_table_separator(line):
            return line
        parts = line.split("|")
        leading_boundary = line.lstrip().startswith("|")
        trailing_boundary = line.rstrip().endswith("|")
        first_index = 1 if leading_boundary else 0
        last_index = len(parts) - 1 if trailing_boundary else len(parts)
        for index in range(first_index, last_index):
            parts[index] = self._segment_preserving_edge_space(parts[index], add_segment)
        return "|".join(parts)

    def _segment_text(self, text: str, segments: list[_Segment]) -> str:
        return self._segment_preserving_edge_space(
            text,
            lambda core: self._add_core_segments(core, segments),
        )

    def _segment_preserving_edge_space(
        self,
        text: str,
        add_core_segment: Callable[[str], str],
    ) -> str:
        if not self._has_translatable_text(text):
            return text
        leading = re.match(r"^\s*", text).group(0)  # type: ignore[union-attr]
        trailing = re.search(r"\s*$", text).group(0)  # type: ignore[union-attr]
        core = text[len(leading) : len(text) - len(trailing) if trailing else len(text)]
        if not core:
            return text
        return leading + add_core_segment(core) + trailing

    def _add_core_segments(self, core: str, segments: list[_Segment]) -> str:
        markers: list[str] = []
        for chunk in self._split_long_text(core):
            protected, replacements = self._protect_tokens(chunk)
            visible_text = protected
            for token in replacements:
                visible_text = visible_text.replace(token, "")
            if not self._has_translatable_text(visible_text):
                markers.append(chunk)
                continue
            marker = f"@@TRANS_SEG_{len(segments)}@@"
            segments.append(_Segment(marker=marker, text=protected, replacements=replacements))
            markers.append(marker)
        return " ".join(markers)

    def _split_long_text(self, text: str, max_chars: int = 900) -> list[str]:
        if len(text) <= max_chars:
            return [text]
        return textwrap.wrap(
            text,
            width=max_chars,
            break_long_words=False,
            break_on_hyphens=False,
        ) or [text]

    def _protect_tokens(self, text: str) -> tuple[str, dict[str, str]]:
        replacements: dict[str, str] = {}

        def replace(match: re.Match[str]) -> str:
            token = f"__MD_KEEP_{len(replacements)}__"
            replacements[token] = match.group(0)
            return token

        return self._token_pattern.sub(replace, text), replacements

    def _restore_tokens(self, text: str, replacements: dict[str, str]) -> str:
        restored = text
        for token, value in replacements.items():
            restored = restored.replace(token, value)
        return restored

    def _has_translatable_text(self, text: str) -> bool:
        stripped = text.strip()
        return len(stripped) > 1 and any(char.isalpha() for char in stripped)

    def _batch_texts(self, texts: list[str], batch_size: int = 100) -> list[list[str]]:
        return [texts[index : index + batch_size] for index in range(0, len(texts), batch_size)]

    def _dominant_language(self, languages: list[str | None]) -> str | None:
        counts = Counter(language for language in languages if language)
        if not counts:
            return None
        return counts.most_common(1)[0][0]

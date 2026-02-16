# PDF to Markdown Converter

A premium web application for converting PDF documents into rich, Obsidian-compatible Markdown formatted using Knowledge Object Schema (KOS) standards.

## 🚀 Features

- **Mistral OCR**: Powered by `mistral-ocr-2505` on Google Cloud Vertex AI for high-fidelity text and image extraction.
- **Obsidian Ready**: Exports as a `.zip` archive containing Markdown files and extracted attachments with automatic Wikilink conversion (`![[image.png]]`).
- **KOS Compliance**: Every generated file includes compliant YAML frontmatter with stable, unique IDs and structural granularity tracking.
- **Vertex AI Analysis**: Built-in integration with Gemini 2.0 Flash for analyzing converted documents directly in the browser with full Markdown support.
- **Enhanced Limits**: Supports documents up to **100 pages** and **100 MB** in size.
- **Secure Access**: Integrated Google Sign-In with fine-grained email and domain allowlisting.
- **Vault Mode**: API-level support for metadata overrides during conversion (type, subtype, scope, etc.).

## 🛠️ Technical Stack

- **Frontend**: Next.js (React), Tailwind CSS, Lucide Icons, ReactMarkdown.
- **Backend**: FastAPI (Python), Mistral Google Cloud SDK, Pydantic.
- **Infrastructure**: Google Cloud Vertex AI, Google Cloud Storage, Google Auth.

## 📦 API & Vault Mode

The converter supports a specialized **Vault Mode** for advanced metadata management. When uploading a document, you can pass `vault_mode=true` along with optional query parameters to override the default KOS metadata:

- `type`: Override Knowledge Object type (Default: `Content`)
- `subtype`: Override subtype (Default: `Report`)
- `use_scope`: Override access scope (Default: `All`)
- `access_level`: Override access level (Default: `open`)
- `export_targets`: List of external systems for export.

## 📝 ID Generation

IDs are generated deterministically to ensure stability within a project:
`BIMei-content-<slugified_filename>-<hash>`

---
Maintainer: **BIMei Microtools**

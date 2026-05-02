# BIMei Markdown Converter

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
- `image_annotations=true`: Include compact OCR image descriptions below extracted figure embeds.

## Backend Service Auth

Backend callers can authenticate with `x-api-key` instead of browser Google Sign-In cookies. Set a shared key in the converter environment and send the same value from the calling backend:

```env
API_KEY=dev-local-converter-key
SERVICE_ACCOUNT_EMAIL=service:mad-evidence
CORS_ORIGINS_RAW=http://localhost:3001,http://localhost:3000
```

Service uploads are recorded with `owner_email` set to `SERVICE_ACCOUNT_EMAIL`. A valid service key can read job status, preview, and download results without a browser session cookie. Browser users can still use Google Sign-In and their session cookie as before.

Local upload example:

```bash
curl -X POST "http://localhost:8000/api/upload?vault_mode=true&type=Content&subtype=Report" \
  -H "x-api-key: dev-local-converter-key" \
  -F "file=@/path/to/document.pdf"
```

Poll status:

```bash
curl "http://localhost:8000/api/status/JOB_ID" \
  -H "x-api-key: dev-local-converter-key"
```

Preview markdown:

```bash
curl "http://localhost:8000/api/preview/JOB_ID" \
  -H "x-api-key: dev-local-converter-key"
```

Download result zip:

```bash
curl -L "http://localhost:8000/api/download/JOB_ID" \
  -H "x-api-key: dev-local-converter-key" \
  -o result.zip
```

## MAD Evidence Normalizer Contract

MAD can call the deployed converter with:

```env
EVIDENCE_NORMALIZER_ADAPTER=markdown_converter_http
MARKDOWN_CONVERTER_BASE_URL=https://markdown-converter-jilezw5qqq-uc.a.run.app
MARKDOWN_CONVERTER_API_KEY=<injected secret>
MARKDOWN_CONVERTER_TIMEOUT_MS=120000
```

The converter accepts `POST /api/upload` as `multipart/form-data` with field
`file` and header `x-api-key`. The JSON response includes `job_id`.

`GET /api/status/{job_id}` returns JSON including `status` and `error`. For
jobs returned by `/api/upload`, MAD should see `processing`, `completed`, or
`failed`; only `completed` means preview is ready.

`GET /api/preview/{job_id}` returns JSON with non-empty `markdown` after the
job is completed. This is the normalized Markdown source MAD should consume.

`GET /api/download/{job_id}` returns the derivative archive as:

- `Content-Type: application/zip`
- `Content-Disposition: attachment; filename="<original_stem>_obsidian.zip"`
- Payload: ZIP containing the Markdown file and any extracted attachments.

Production Cloud Run is configured with `API_KEY` from Secret Manager,
`SERVICE_ACCOUNT_EMAIL=service:mad-evidence`, and a 300 second request timeout.
The app limit is 100 MB, but the current Cloud Run container serves HTTP/1, so
direct multipart request size is constrained by Cloud Run's HTTP/1 request
limit. For evidence files larger than that limit, add a signed-upload flow
instead of posting the file through `/api/upload`.

## 📝 ID Generation

IDs are generated deterministically to ensure stability within a project:
`BIMei-content-<slugified_filename>-<hash>`

---
Maintainer: **BIMei Microtools**

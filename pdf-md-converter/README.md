# PDF to Markdown Converter

Convert PDF documents to Obsidian-compatible Markdown using Mistral OCR (`mistral-ocr-2505`) via Vertex AI Model Garden, with optional Vertex AI Gemini analysis.

## Features

- Mistral OCR with image extraction
- Obsidian-ready Markdown output (`.md` + `attachments/`)
- Downloadable ZIP export
- Optional Gemini analysis (`/api/analyze/{job_id}`)
- Single-container deployment (FastAPI + static Next.js)

## Architecture

Single-container deployment:

- `GET /health` for health checks
- `POST /api/*` and `GET /api/*` for app API
- `/*` serves static frontend (`frontend/out`)

## Confirmed Mistral Requirements (Vertex AI Model Garden)

- Model: `mistral-ocr-2505`
- Per-request limits include:
  - Maximum 30 pages per OCR request
  - Max request size is documented as 30 MB (streaming) / 10 MB (unary)
- Vertex AI partner model locations currently include `us-central1` and `europe-west4`.
- You must enable the model in Vertex AI Model Garden for your project before use.

This project enforces batching (`MAX_PAGES_PER_REQUEST`, default `30`) to stay within model constraints.

## Prerequisites

1. Google Cloud project with billing enabled.
2. APIs enabled:
   - Vertex AI API
   - Cloud Storage API
   - Cloud Build API
   - Cloud Run Admin API
3. Model access enabled for `mistral-ocr-2505` in Vertex AI Model Garden.
4. Workload Identity Federation configured for GitHub Actions (recommended for deploy workflow).

## Buckets You Need

Create two buckets (recommended separation):

1. Upload bucket (raw PDFs)
2. Results bucket (job metadata, markdown, zip outputs)

Example:

```bash
gsutil mb -l us-central1 gs://YOUR_UPLOAD_BUCKET
gsutil mb -l us-central1 gs://YOUR_RESULTS_BUCKET
```

Recommended lifecycle policies:

- Upload bucket: delete objects after 1 day.
- Results bucket: delete objects after 7 days.

Example lifecycle JSON:

```json
{
  "lifecycle": {
    "rule": [
      {
        "action": { "type": "Delete" },
        "condition": { "age": 7 }
      }
    ]
  }
}
```

Apply with:

```bash
gsutil lifecycle set lifecycle.json gs://YOUR_RESULTS_BUCKET
```

## Local Development

### 1. Configure environment

```bash
cp .env.example .env
```

Set at minimum:

- `GCP_PROJECT_ID`
- `GCS_BUCKET_NAME` (fallback bucket)
- `GCS_UPLOAD_BUCKET_NAME`
- `GCS_RESULTS_BUCKET_NAME`

### 2. Run backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Run frontend (port 3001)

```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

Open [http://localhost:3001](http://localhost:3001).

## Docker Build

```bash
docker build -t pdf-md-converter .

docker run -p 8080:8080 \
  -e GCP_PROJECT_ID=your-project-id \
  -e GCP_REGION=us-central1 \
  -e GCS_BUCKET_NAME=your-upload-bucket \
  -e GCS_UPLOAD_BUCKET_NAME=your-upload-bucket \
  -e GCS_RESULTS_BUCKET_NAME=your-results-bucket \
  -v ~/.config/gcloud:/root/.config/gcloud \
  pdf-md-converter
```

## CI and Deployment (GitHub Actions)

Deployment is designed to run through GitHub Actions workflows, not ad-hoc local deploy commands.

- CI: `.github/workflows/ci.yml`
- Deploy: `.github/workflows/deploy-cloud-run.yml` (manual `workflow_dispatch`)

### Required GitHub Secrets

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT`

### IAM Required for Deploy Service Account

- `roles/run.admin`
- `roles/iam.serviceAccountUser`
- `roles/cloudbuild.builds.editor`
- `roles/storage.admin` (or scoped bucket-level permissions)

### IAM Required for Runtime Cloud Run Service Account

- `roles/storage.objectAdmin` on upload/results buckets
- `roles/aiplatform.user` (for Gemini analyze endpoint)
- `roles/iam.serviceAccountTokenCreator` (needed for V4 signed URL generation)

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/upload` | Upload PDF, returns `job_id` |
| `GET` | `/api/status/{job_id}` | Poll job status |
| `GET` | `/api/preview/{job_id}` | Fetch converted markdown |
| `GET` | `/api/download/{job_id}` | Download ZIP export |
| `POST` | `/api/analyze/{job_id}` | Analyze converted markdown with Gemini |
| `GET` | `/health` | Health check |

## Notes on Production Hardening

- Set `API_KEY` to enforce API key checks for upload/analyze endpoints.
- Prefer authenticated Cloud Run deployments (`allow_unauthenticated=false`).
- Keep lifecycle policies enabled to control storage cost.

## License

CC BY-NC-SA 4.0 - BIM Excellence Initiative

export interface UploadResponse {
  job_id: string;
  status: string;
  message: string;
}

export interface JobStatus {
  job_id: string;
  status: "uploading" | "processing" | "completed" | "failed";
  progress?: number | null;
  message?: string | null;
  error?: string | null;
  created_at: string;
  completed_at?: string | null;
  result_available: boolean;
}

export interface JobLogItem {
  job_id: string;
  status: "uploading" | "processing" | "completed" | "failed";
  original_filename: string;
  file_type?: string | null;
  original_content_type?: string | null;
  original_file_size?: number | null;
  owner_email: string;
  created_at: string;
  completed_at?: string | null;
  result_available: boolean;
  source_available: boolean;
  markdown_available: boolean;
  archive_available: boolean;
  error?: string | null;
}

export interface JobLogResponse {
  jobs: JobLogItem[];
}

export interface JobDeleteResponse {
  ok: boolean;
}

export interface PreviewResponse {
  job_id: string;
  markdown: string;
}

export interface AnalyzeResponse {
  job_id: string;
  analysis: string;
  token_count?: number | null;
}

export interface AuthUser {
  email: string;
  name?: string | null;
  picture?: string | null;
}

export interface AuthResponse {
  user: AuthUser;
}

export interface UploadOptions {
  imageAnnotations?: boolean;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "";

function withAuthHeaders(headers?: HeadersInit): Headers {
  const merged = new Headers(headers);
  if (API_KEY) {
    merged.set("x-api-key", API_KEY);
  }
  return merged;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    ...init,
    headers: withAuthHeaders(init?.headers),
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  uploadPDF(file: File, options: UploadOptions = {}): Promise<UploadResponse> {
    const form = new FormData();
    form.append("file", file);
    const query = options.imageAnnotations ? "?image_annotations=true" : "";
    return request(`/api/upload${query}`, { method: "POST", body: form });
  },

  getJobStatus(jobId: string): Promise<JobStatus> {
    return request(`/api/status/${jobId}`);
  },

  getJobLog(): Promise<JobLogResponse> {
    return request("/api/jobs");
  },

  deleteJob(jobId: string): Promise<JobDeleteResponse> {
    return request(`/api/jobs/${jobId}`, { method: "DELETE" });
  },

  getPreview(jobId: string): Promise<PreviewResponse> {
    return request(`/api/preview/${jobId}`);
  },

  documentUrl(path: "source" | "output" | "download", jobId: string): string {
    return `${BASE_URL}/api/${path}/${jobId}`;
  },

  async downloadResult(jobId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/download/${jobId}`, {
      headers: withAuthHeaders(),
      credentials: "include",
    });
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `obsidian_export_${jobId}.zip`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
  },

  analyzeDocument(jobId: string, prompt: string): Promise<AnalyzeResponse> {
    return request(`/api/analyze/${jobId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
  },

  authGoogle(credential: string): Promise<AuthResponse> {
    return request("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
  },

  me(): Promise<AuthResponse> {
    return request("/api/auth/me");
  },

  logout(): Promise<{ ok: boolean }> {
    return request("/api/auth/logout", { method: "POST" });
  },
};

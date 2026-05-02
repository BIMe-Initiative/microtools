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
  source_markdown_available: boolean;
  translated: boolean;
  translation_available: boolean;
  translation_status?: string | null;
  translation_error?: string | null;
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
  variant: "primary" | "source" | "english";
  translated: boolean;
  source_language?: string | null;
  target_language?: string | null;
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
  translateToEnglish?: boolean;
  sourceLanguage?: string;
}

export type MarkdownVariant = "primary" | "source" | "english";

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
    const params = new URLSearchParams();
    if (options.imageAnnotations) params.set("image_annotations", "true");
    if (options.translateToEnglish) {
      params.set("translate_to_english", "true");
      if (options.sourceLanguage) params.set("source_language", options.sourceLanguage);
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    return request(`/api/upload${query}`, { method: "POST", body: form });
  },

  getJobStatus(jobId: string): Promise<JobStatus> {
    return request(`/api/status/${jobId}`);
  },

  getJobLog(limit?: number): Promise<JobLogResponse> {
    const query = limit ? `?limit=${limit}` : "";
    return request(`/api/jobs${query}`);
  },

  deleteJob(jobId: string): Promise<JobDeleteResponse> {
    return request(`/api/jobs/${jobId}`, { method: "DELETE" });
  },

  getPreview(jobId: string, variant: MarkdownVariant = "primary"): Promise<PreviewResponse> {
    const query = variant === "primary" ? "" : `?variant=${variant}`;
    return request(`/api/preview/${jobId}${query}`);
  },

  documentUrl(
    path: "source" | "output" | "download",
    jobId: string,
    variant?: MarkdownVariant
  ): string {
    const query = path === "output" && variant ? `?variant=${variant}` : "";
    return `${BASE_URL}/api/${path}/${jobId}${query}`;
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

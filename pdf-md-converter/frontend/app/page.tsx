"use client";

import { useCallback, useState } from "react";
import { UploadZone } from "@/components/upload-zone";
import { ProcessingStatus } from "@/components/processing-status";
import { MarkdownPreview } from "@/components/markdown-preview";
import { ActionButtons } from "@/components/action-buttons";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";

type AppState = "idle" | "uploading" | "processing" | "completed" | "failed";

export default function Home() {
  const [state, setState] = useState<AppState>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    try {
      setState("uploading");
      setError(null);
      const res = await api.uploadPDF(file);
      setJobId(res.job_id);
      setState("processing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setState("idle");
    }
  };

  const handleComplete = useCallback(async () => {
    if (!jobId) return;
    try {
      const preview = await api.getPreview(jobId);
      setMarkdown(preview.markdown);
      setState("completed");
    } catch {
      setMarkdown("");
      setState("completed");
    }
  }, [jobId]);

  const handleFailed = useCallback((msg: string) => {
    setError(msg);
    setState("failed");
  }, []);

  const reset = () => {
    setState("idle");
    setJobId(null);
    setMarkdown("");
    setError(null);
  };

  return (
    <div className="space-y-8">
      {/* Upload state */}
      {(state === "idle" || state === "uploading") && (
        <div className="max-w-2xl mx-auto">
          <UploadZone
            onUpload={handleUpload}
            disabled={state === "uploading"}
          />
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Processing state */}
      {state === "processing" && jobId && (
        <div className="max-w-2xl mx-auto">
          <ProcessingStatus
            jobId={jobId}
            onComplete={handleComplete}
            onFailed={handleFailed}
          />
        </div>
      )}

      {/* Failed state */}
      {state === "failed" && (
        <div className="max-w-2xl mx-auto space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error ?? "Processing failed"}</AlertDescription>
          </Alert>
          <Button onClick={reset} variant="outline">
            <RotateCcw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      )}

      {/* Completed state — split view */}
      {state === "completed" && jobId && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Conversion Complete</h2>
            <Button onClick={reset} variant="outline">
              <RotateCcw className="mr-2 h-4 w-4" />
              Convert Another
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <MarkdownPreview markdown={markdown} />
            </div>
            <div>
              <ActionButtons jobId={jobId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

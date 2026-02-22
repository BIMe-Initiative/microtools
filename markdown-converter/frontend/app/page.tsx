"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UploadZone } from "@/components/upload-zone";
import { ProcessingStatus } from "@/components/processing-status";
import { MarkdownPreview } from "@/components/markdown-preview";
import { ActionButtons } from "@/components/action-buttons";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RotateCcw } from "lucide-react";
import { api, type AuthUser } from "@/lib/api";

type AppState = "idle" | "uploading" | "processing" | "completed" | "failed";


export default function Home() {
  const [state, setState] = useState<AppState>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [uploadedFileNames, setUploadedFileNames] = useState<string[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

  useEffect(() => {
    let mounted = true;
    api
      .me()
      .then((res) => {
        if (mounted) setUser(res.user);
      })
      .catch(() => {
        if (mounted) setUser(null);
      })
      .finally(() => {
        if (mounted) setAuthLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (authLoading || user || !googleClientId || !googleButtonRef.current) return;
    if (!window.google?.accounts?.id) return;

    const handleCredential = async (response: { credential: string }) => {
      try {
        const res = await api.authGoogle(response.credential);
        setUser(res.user);
        setAuthError(null);
      } catch (err) {
        setAuthError(
          err instanceof Error ? err.message : "Google sign-in failed"
        );
      }
    };

    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: handleCredential,
    });
    googleButtonRef.current.innerHTML = "";
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: "outline",
      size: "large",
      text: "signin_with",
    });
  }, [authLoading, user, googleClientId]);

  const handleUpload = async (file: File) => {
    try {
      setState("uploading");
      setError(null);
      const duplicate = uploadedFileNames.some(
        (name) => name.toLowerCase() === file.name.toLowerCase()
      );
      setDuplicateWarning(
        duplicate
          ? "A file with the same name was uploaded before. A new conversion will be created."
          : null
      );
      setUploadedFileNames((prev) => {
        if (prev.some((name) => name.toLowerCase() === file.name.toLowerCase())) {
          return prev;
        }
        return [...prev, file.name];
      });
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
    setDuplicateWarning(null);
  };

  const handleLogout = async () => {
    await api.logout().catch(() => undefined);
    setUser(null);
    reset();
  };

  if (authLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <Alert>
          <AlertDescription>Checking authentication...</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Alert>
          <AlertDescription>
            Sign in with Google to use the PDF converter.
          </AlertDescription>
        </Alert>
        {!googleClientId && (
          <Alert variant="destructive">
            <AlertDescription>
              Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID configuration.
            </AlertDescription>
          </Alert>
        )}
        <div ref={googleButtonRef} />
        {authError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{authError}</AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="max-w-2xl mx-auto flex items-center justify-between border rounded-md p-3">
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{user.email}</span>
        </p>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          Sign out
        </Button>
      </div>

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
          {duplicateWarning && !error && (
            <Alert className="mt-4">
              <AlertDescription>{duplicateWarning}</AlertDescription>
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

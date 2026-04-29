"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { UploadZone } from "@/components/upload-zone";
import { ProcessingStatus } from "@/components/processing-status";
import { MarkdownPreview } from "@/components/markdown-preview";
import { ActionButtons } from "@/components/action-buttons";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  ArrowRight,
  FileText,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api, type AuthUser } from "@/lib/api";

type AppState = "idle" | "uploading" | "processing" | "completed" | "failed";

const conversionSteps = [
  { label: "Upload", tone: "text-brand-coral-press", dot: "bg-brand-coral" },
  { label: "OCR", tone: "text-indigo-700", dot: "bg-indigo-500" },
  { label: "Markdown", tone: "text-emerald-700", dot: "bg-emerald-500" },
];

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
      <div className="mx-auto max-w-3xl">
        <Alert>
          <AlertDescription>Checking authentication...</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!user) {
    return (
      <section className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,0.58fr)_minmax(320px,0.42fr)]">
        <div className="rounded-lg border border-surface-line bg-white p-6 shadow-[0_4px_16px_rgba(15,23,42,0.04)] sm:p-8">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-700">
            Secure access
          </div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink-display sm:text-4xl">
            BIMei Markdown Converter
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-base">
            Sign in to convert PDF, DOCX, and XLSX files into structured
            Markdown with extracted assets ready for BIMei knowledge workflows.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {conversionSteps.map((step) => (
              <div
                key={step.label}
                className={`inline-flex items-center gap-2 rounded-full border border-surface-line bg-white px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${step.tone}`}
              >
                <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${step.dot}`} />
                {step.label}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-6 shadow-[0_4px_16px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-800">
            <ShieldCheck className="h-4 w-4" />
            Google sign-in
          </div>
          <p className="mt-3 text-sm leading-relaxed text-amber-900">
            Use an approved Google account to access the converter.
          </p>
          <div className="mt-5" ref={googleButtonRef} />
          {!googleClientId && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>
                Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID configuration.
              </AlertDescription>
            </Alert>
          )}
          {authError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{authError}</AlertDescription>
            </Alert>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-lg border border-surface-line bg-white shadow-[0_4px_16px_rgba(15,23,42,0.04)]">
        <div className="border-b border-surface-line bg-gradient-to-r from-brand-coral-tint via-indigo-50 to-emerald-50 px-5 py-6 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-coral-press">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-coral" />
                Document to Markdown
              </div>
              <h2 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-ink-display sm:text-4xl">
                Convert source documents into clean BIMei-ready Markdown.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-base">
                Upload a document, let Mistral OCR extract its structure, then
                preview, download, or send the result for analysis.
              </p>
            </div>
            <div className="shrink-0 rounded-lg border border-surface-line bg-white/80 px-4 py-3 text-sm text-ink-muted shadow-[0_4px_16px_rgba(15,23,42,0.04)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted/70">
                Signed in
              </div>
              <div className="mt-1 max-w-[260px] truncate font-semibold text-ink">
                {user.email}
              </div>
              <Button
                variant="link"
                size="sm"
                onClick={handleLogout}
                className="mt-1 h-auto px-0 py-0"
              >
                Sign out
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,0.64fr)_minmax(320px,0.36fr)]">
          <div>
            {(state === "idle" || state === "uploading") && (
              <div>
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

            {state === "processing" && jobId && (
              <ProcessingStatus
                jobId={jobId}
                onComplete={handleComplete}
                onFailed={handleFailed}
              />
            )}

            {state === "failed" && (
              <div className="space-y-4">
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
          </div>

          <aside className="rounded-lg border border-surface-line bg-surface-muted p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-700">
              Workflow
            </div>
            <div className="mt-4 space-y-4">
              <WorkflowItem
                icon={<FileText className="h-4 w-4" />}
                title="Document intake"
                body="PDF, DOCX, and XLSX files up to 100 MB."
                tone="text-sky-700"
              />
              <WorkflowItem
                icon={<Sparkles className="h-4 w-4" />}
                title="Mistral OCR"
                body="Text, headings, tables, and images are normalized."
                tone="text-brand-coral-press"
              />
              <WorkflowItem
                icon={<ArrowRight className="h-4 w-4" />}
                title="Markdown export"
                body="Download an Obsidian-ready archive with attachments."
                tone="text-emerald-700"
              />
            </div>
          </aside>
        </div>
      </section>

      {state === "completed" && jobId && (
        <section className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Conversion complete
              </div>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink-display">
                Review and export Markdown
              </h2>
            </div>
            <Button onClick={reset} variant="outline">
              <RotateCcw className="mr-2 h-4 w-4" />
              Convert Another
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <MarkdownPreview markdown={markdown} />
            </div>
            <div>
              <ActionButtons jobId={jobId} />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function WorkflowItem({
  icon,
  title,
  body,
  tone,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-surface-line bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.04)]">
      <div className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] ${tone}`}>
        {icon}
        {title}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
    </div>
  );
}

"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { UploadZone } from "@/components/upload-zone";
import { ProcessingStatus } from "@/components/processing-status";
import { MarkdownPreview } from "@/components/markdown-preview";
import { ActionButtons } from "@/components/action-buttons";
import { ConversionLog } from "@/components/conversion-log";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  ArrowRight,
  ChartNoAxesCombined,
  Copy,
  FileText,
  History,
  Languages,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api, type AuthUser, type JobLogItem, type MarkdownVariant } from "@/lib/api";

type AppState = "idle" | "uploading" | "processing" | "completed" | "failed";

type DuplicateUpload = {
  file: File;
  matchingJobs: JobLogItem[];
  parsedNames: string[];
};

type CopyNameChoice = "suffix" | "custom";
type DuplicateAction = "override" | "copy";

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
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [historyCheckLoading, setHistoryCheckLoading] = useState(false);
  const [uploadZoneKey, setUploadZoneKey] = useState(0);
  const [pendingDuplicate, setPendingDuplicate] = useState<DuplicateUpload | null>(null);
  const [copyNameChoice, setCopyNameChoice] = useState<CopyNameChoice>("suffix");
  const [customCopyName, setCustomCopyName] = useState("");
  const [duplicateAction, setDuplicateAction] = useState<DuplicateAction | null>(null);
  const [logRefreshKey, setLogRefreshKey] = useState(0);
  const [imageAnnotations, setImageAnnotations] = useState(false);
  const [translateToEnglish, setTranslateToEnglish] = useState(false);
  const [currentJobTranslated, setCurrentJobTranslated] = useState(false);
  const [markdownVariant, setMarkdownVariant] = useState<"english" | "source">("source");
  const [variantLoading, setVariantLoading] = useState(false);
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

  const copyFilename = useMemo(() => {
    if (!pendingDuplicate) return "";
    return copyNameChoice === "suffix"
      ? copySuffixName(pendingDuplicate.file.name)
      : normalizeCustomCopyName(customCopyName, pendingDuplicate.file.name);
  }, [copyNameChoice, customCopyName, pendingDuplicate]);

  const copyNameError = useMemo(() => {
    if (!pendingDuplicate) return null;
    return validateCopyName(
      copyFilename,
      pendingDuplicate.file.name,
      pendingDuplicate.parsedNames,
      copyNameChoice === "custom" ? customCopyName : undefined
    );
  }, [copyFilename, copyNameChoice, customCopyName, pendingDuplicate]);

  const uploadDisabled =
    state === "uploading" ||
    historyCheckLoading ||
    pendingDuplicate !== null ||
    duplicateAction !== null;

  const beginUpload = async (file: File) => {
    try {
      setState("uploading");
      setError(null);
      setUploadError(null);
      setJobId(null);
      setMarkdown("");
      setCurrentJobTranslated(translateToEnglish);
      setMarkdownVariant(translateToEnglish ? "english" : "source");
      const res = await api.uploadPDF(file, { imageAnnotations, translateToEnglish });
      setJobId(res.job_id);
      setState("processing");
      setLogRefreshKey((value) => value + 1);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setState("idle");
    } finally {
      setUploadZoneKey((value) => value + 1);
    }
  };

  const handleUpload = async (file: File) => {
    try {
      setHistoryCheckLoading(true);
      setError(null);
      setUploadError(null);
      const history = await api.getJobLog(500);
      const parsedJobs = history.jobs.filter(isParsedJob);
      const matchingJobs = parsedJobs.filter((job) =>
        filenamesMatch(job.original_filename, file.name)
      );
      if (matchingJobs.length > 0) {
        setPendingDuplicate({
          file,
          matchingJobs,
          parsedNames: parsedJobs.map((job) => job.original_filename),
        });
        setCopyNameChoice("suffix");
        setCustomCopyName("");
        return;
      }
      await beginUpload(file);
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? `Could not check Document History: ${err.message}`
          : "Could not check Document History"
      );
    } finally {
      setHistoryCheckLoading(false);
    }
  };

  const handleCancelDuplicate = () => {
    setPendingDuplicate(null);
    setDuplicateAction(null);
    setUploadError(null);
    setUploadZoneKey((value) => value + 1);
  };

  const handleOverrideDuplicate = async () => {
    if (!pendingDuplicate) return;
    try {
      setDuplicateAction("override");
      setUploadError(null);
      await Promise.all(
        pendingDuplicate.matchingJobs.map((job) => api.deleteJob(job.job_id))
      );
      const file = pendingDuplicate.file;
      setPendingDuplicate(null);
      setLogRefreshKey((value) => value + 1);
      await beginUpload(file);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not override document");
    } finally {
      setDuplicateAction(null);
    }
  };

  const handleUploadCopy = async () => {
    if (!pendingDuplicate || copyNameError) return;
    try {
      setDuplicateAction("copy");
      setUploadError(null);
      const copy = cloneFileWithName(pendingDuplicate.file, copyFilename);
      setPendingDuplicate(null);
      await beginUpload(copy);
    } finally {
      setDuplicateAction(null);
    }
  };

  const handleComplete = useCallback(async () => {
    if (!jobId) return;
    try {
      const preview = await api.getPreview(jobId);
      setMarkdown(preview.markdown);
      setCurrentJobTranslated(Boolean(preview.translated));
      setMarkdownVariant(preview.translated ? "english" : "source");
      setState("completed");
      setUploadZoneKey((value) => value + 1);
      setLogRefreshKey((value) => value + 1);
    } catch {
      setMarkdown("");
      setState("completed");
      setUploadZoneKey((value) => value + 1);
      setLogRefreshKey((value) => value + 1);
    }
  }, [jobId]);

  const handleFailed = useCallback((msg: string) => {
    setError(msg);
    setState("failed");
    setUploadZoneKey((value) => value + 1);
    setLogRefreshKey((value) => value + 1);
  }, []);

  const reset = () => {
    setState("idle");
    setJobId(null);
    setMarkdown("");
    setError(null);
    setUploadError(null);
    setPendingDuplicate(null);
    setDuplicateAction(null);
    setCurrentJobTranslated(false);
    setMarkdownVariant("source");
    setUploadZoneKey((value) => value + 1);
  };

  const loadMarkdownVariant = async (variant: "english" | "source") => {
    if (!jobId || variant === markdownVariant) return;
    try {
      setVariantLoading(true);
      setError(null);
      const preview = await api.getPreview(jobId, variant as MarkdownVariant);
      setMarkdown(preview.markdown);
      setMarkdownVariant(variant);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Markdown variant");
    } finally {
      setVariantLoading(false);
    }
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
              <div className="flex items-center gap-3">
                <UserAvatar
                  email={user.email}
                  name={user.name}
                  picture={user.picture}
                  size={40}
                />
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted/70">
                    Signed in
                  </div>
                  <div className="mt-1 max-w-[260px] truncate font-semibold text-ink">
                    {user.name || user.email}
                  </div>
                  {user.name && (
                    <div className="mt-0.5 max-w-[260px] truncate text-xs text-ink-muted">
                      {user.email}
                    </div>
                  )}
                </div>
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

        <div className="grid items-stretch gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,0.64fr)_minmax(320px,0.36fr)]">
          <div className="min-w-0">
            {(state === "idle" || state === "uploading" || state === "completed") && (
              <div className="h-full">
                <UploadZone
                  key={uploadZoneKey}
                  onUpload={handleUpload}
                  disabled={uploadDisabled}
                  imageAnnotations={imageAnnotations}
                  onImageAnnotationsChange={setImageAnnotations}
                  translateToEnglish={translateToEnglish}
                  onTranslateToEnglishChange={setTranslateToEnglish}
                />
                {historyCheckLoading && (
                  <Alert className="mt-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <AlertDescription>Checking Document History...</AlertDescription>
                  </Alert>
                )}
                {uploadError && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{uploadError}</AlertDescription>
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

          <aside className="flex h-full flex-col rounded-lg border border-surface-line bg-surface-muted p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-700">
              Workflow
            </div>
            <div className="mt-4 grid flex-1 content-stretch gap-4">
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
                icon={<ChartNoAxesCombined className="h-4 w-4" />}
                title="Figure annotation"
                body="Optionally describe extracted figures and charts in the Markdown."
                tone="text-violet-700"
              />
              <WorkflowItem
                icon={<Languages className="h-4 w-4" />}
                title="LOTE translation"
                body="Optionally produce English Markdown while retaining the source-language file."
                tone="text-emerald-700"
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
              {error && (
                <Alert variant="destructive" className="mb-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {currentJobTranslated && (
                <div className="mb-3 inline-flex rounded-md border border-surface-line bg-white p-1 shadow-[0_4px_16px_rgba(15,23,42,0.04)]">
                  <Button
                    type="button"
                    size="sm"
                    variant={markdownVariant === "english" ? "default" : "ghost"}
                    disabled={variantLoading}
                    onClick={() => void loadMarkdownVariant("english")}
                    className="h-8 rounded"
                  >
                    {variantLoading && markdownVariant !== "english" ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    English
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={markdownVariant === "source" ? "default" : "ghost"}
                    disabled={variantLoading}
                    onClick={() => void loadMarkdownVariant("source")}
                    className="h-8 rounded"
                  >
                    {variantLoading && markdownVariant !== "source" ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Source LOTE
                  </Button>
                </div>
              )}
              <MarkdownPreview markdown={markdown} />
            </div>
            <div>
              <ActionButtons jobId={jobId} />
            </div>
          </div>
        </section>
      )}

      <ConversionLog refreshKey={logRefreshKey} />

      {pendingDuplicate && (
        <DuplicateUploadDialog
          fileName={pendingDuplicate.file.name}
          matchingCount={pendingDuplicate.matchingJobs.length}
          latestJob={pendingDuplicate.matchingJobs[0]}
          copyNameChoice={copyNameChoice}
          customCopyName={customCopyName}
          copyFilename={copyFilename}
          copyNameError={copyNameError}
          action={duplicateAction}
          error={uploadError}
          onCopyNameChoiceChange={setCopyNameChoice}
          onCustomCopyNameChange={setCustomCopyName}
          onCancel={handleCancelDuplicate}
          onOverride={handleOverrideDuplicate}
          onUploadCopy={handleUploadCopy}
        />
      )}
    </div>
  );
}

function DuplicateUploadDialog({
  fileName,
  matchingCount,
  latestJob,
  copyNameChoice,
  customCopyName,
  copyFilename,
  copyNameError,
  action,
  error,
  onCopyNameChoiceChange,
  onCustomCopyNameChange,
  onCancel,
  onOverride,
  onUploadCopy,
}: {
  fileName: string;
  matchingCount: number;
  latestJob?: JobLogItem;
  copyNameChoice: CopyNameChoice;
  customCopyName: string;
  copyFilename: string;
  copyNameError: string | null;
  action: DuplicateAction | null;
  error: string | null;
  onCopyNameChoiceChange: (choice: CopyNameChoice) => void;
  onCustomCopyNameChange: (name: string) => void;
  onCancel: () => void;
  onOverride: () => void;
  onUploadCopy: () => void;
}) {
  const busy = action !== null;
  const entryLabel = matchingCount === 1 ? "entry" : "entries";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="duplicate-upload-title"
        className="w-full max-w-2xl rounded-lg border border-surface-line bg-white shadow-[0_18px_50px_rgba(15,23,42,0.22)]"
      >
        <div className="border-b border-surface-line px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
              <History className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-700">
                Document History match
              </div>
              <h3
                id="duplicate-upload-title"
                className="mt-1 truncate text-xl font-semibold tracking-tight text-ink-display"
              >
                This document has already been parsed
              </h3>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-6">
          <div className="rounded-lg border border-surface-line bg-surface-muted px-4 py-3 text-sm text-ink-muted">
            <div className="font-semibold text-ink-display">{fileName}</div>
            <div className="mt-1">
              Found {matchingCount} completed {entryLabel}
              {latestJob
                ? `, latest parsed ${formatHistoryDate(latestJob.completed_at ?? latestJob.created_at)}`
                : ""}
              .
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-lg border border-surface-line p-4">
              <div className="text-sm font-semibold text-ink-display">
                Override existing
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                Remove the matching completed history {entryLabel} and parse
                this upload using the same file name.
              </p>
              <Button
                type="button"
                onClick={onOverride}
                disabled={busy}
                className="mt-4 w-full rounded-md"
              >
                {action === "override" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="mr-2 h-4 w-4" />
                )}
                Override
              </Button>
            </div>

            <div className="rounded-lg border border-surface-line p-4">
              <div className="text-sm font-semibold text-ink-display">
                Create a new copy
              </div>
              <div className="mt-3 space-y-3">
                <label className="flex cursor-pointer gap-3 rounded-md border border-surface-line px-3 py-2 text-sm">
                  <input
                    type="radio"
                    name="copy-name-choice"
                    value="suffix"
                    checked={copyNameChoice === "suffix"}
                    onChange={() => onCopyNameChoiceChange("suffix")}
                    disabled={busy}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-semibold text-ink">Add _Copy suffix</span>
                    <span className="block break-all text-xs text-ink-muted">
                      {copySuffixName(fileName)}
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer gap-3 rounded-md border border-surface-line px-3 py-2 text-sm">
                  <input
                    type="radio"
                    name="copy-name-choice"
                    value="custom"
                    checked={copyNameChoice === "custom"}
                    onChange={() => onCopyNameChoiceChange("custom")}
                    disabled={busy}
                    className="mt-1"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">Choose a new name</span>
                    <input
                      value={customCopyName}
                      onFocus={() => onCopyNameChoiceChange("custom")}
                      onChange={(event) => onCustomCopyNameChange(event.target.value)}
                      disabled={busy}
                      placeholder={copySuffixName(fileName)}
                      className="mt-2 h-10 w-full rounded-md border border-surface-line bg-white px-3 text-sm text-ink outline-none transition focus:border-brand-coral focus:ring-2 focus:ring-brand-coral/20"
                    />
                  </span>
                </label>
              </div>

              <div className="mt-3 break-all rounded-md bg-surface-muted px-3 py-2 text-xs text-ink-muted">
                New upload name: <span className="font-semibold text-ink">{copyFilename}</span>
              </div>
              {copyNameError && (
                <div className="mt-2 text-xs font-semibold text-red-700">
                  {copyNameError}
                </div>
              )}
              <Button
                type="button"
                onClick={onUploadCopy}
                disabled={busy || Boolean(copyNameError)}
                className="mt-4 w-full rounded-md"
              >
                {action === "copy" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                Upload Copy
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-surface-line px-5 py-4 sm:px-6">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      </div>
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

function isParsedJob(job: JobLogItem): boolean {
  return job.status === "completed";
}

function filenamesMatch(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function splitFilename(filename: string): { name: string; extension: string } {
  const extensionIndex = filename.lastIndexOf(".");
  if (extensionIndex <= 0) return { name: filename, extension: "" };
  return {
    name: filename.slice(0, extensionIndex),
    extension: filename.slice(extensionIndex),
  };
}

function copySuffixName(filename: string): string {
  const { name, extension } = splitFilename(filename);
  return `${name}_Copy${extension}`;
}

function normalizeCustomCopyName(value: string, originalFilename: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const { extension } = splitFilename(originalFilename);
  if (
    !extension ||
    trimmed.toLowerCase().endsWith(extension.toLowerCase()) ||
    trimmed.includes(".")
  ) {
    return trimmed;
  }
  return `${trimmed}${extension}`;
}

function validateCopyName(
  copyFilename: string,
  originalFilename: string,
  parsedNames: string[],
  customName?: string
): string | null {
  if (customName !== undefined && !customName.trim()) {
    return "Enter a new file name or use the _Copy suffix.";
  }
  if (!copyFilename.trim()) {
    return "Choose a new file name.";
  }
  if (/[\\/]/.test(copyFilename)) {
    return "File names cannot include path separators.";
  }
  const { extension } = splitFilename(originalFilename);
  if (extension && !copyFilename.toLowerCase().endsWith(extension.toLowerCase())) {
    return `Keep the ${extension} extension.`;
  }
  if (filenamesMatch(copyFilename, originalFilename)) {
    return "The copy needs a different name from the existing parsed document.";
  }
  if (parsedNames.some((name) => filenamesMatch(name, copyFilename))) {
    return "That file name is already parsed in Document History.";
  }
  return null;
}

function cloneFileWithName(file: File, filename: string): File {
  return new File([file], filename, {
    type: file.type,
    lastModified: file.lastModified,
  });
}

function formatHistoryDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

"use client";

import { useCallback, useState } from "react";
import { Upload, FileText, AlertCircle, ImageIcon, Languages } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface UploadZoneProps {
  onUpload: (file: File) => void;
  disabled?: boolean;
  imageAnnotations: boolean;
  onImageAnnotationsChange: (enabled: boolean) => void;
  translateToEnglish: boolean;
  onTranslateToEnglishChange: (enabled: boolean) => void;
}

const MAX_SIZE = 100 * 1024 * 1024; // 100 MB

export function UploadZone({
  onUpload,
  disabled,
  imageAnnotations,
  onImageAnnotationsChange,
  translateToEnglish,
  onTranslateToEnglishChange,
}: UploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback(
    (file: File) => {
      setError(null);
      const allowedTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      ];
      if (!allowedTypes.includes(file.type)) {
        setError("Only PDF, DOCX, and XLSX files are supported.");
        return;
      }
      if (file.size > MAX_SIZE) {
        setError("File must be smaller than 100 MB.");
        return;
      }
      onUpload(file);
    },
    [onUpload]
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) validate(file);
    },
    [validate]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validate(file);
    },
    [validate]
  );

  return (
    <Card className="flex h-full flex-col overflow-hidden p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
            Upload source
          </div>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-ink-display">
            Choose a document
          </h3>
        </div>
        <div className="rounded-full border border-surface-line bg-surface-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          100 MB max
        </div>
      </div>
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative flex min-h-[360px] flex-1 rounded-lg border-2 border-dashed p-8 transition-all sm:p-12 ${dragActive
            ? "border-brand-coral bg-brand-coral-tint"
            : "border-surface-line bg-surface-muted"
          } ${disabled ? "pointer-events-none opacity-50" : "cursor-pointer hover:border-brand-coral hover:bg-brand-coral-tint/50"}`}
      >
        <input
          type="file"
          id="pdf-upload"
          accept=".pdf,.docx,.xlsx"
          onChange={handleChange}
          disabled={disabled}
          className="hidden"
        />
        <label
          htmlFor="pdf-upload"
          className="flex h-full flex-1 cursor-pointer flex-col items-center justify-center"
        >
          {dragActive ? (
            <Upload className="mb-4 h-16 w-16 text-brand-coral-press" />
          ) : (
            <FileText className="mb-4 h-16 w-16 text-indigo-600" />
          )}
          <div className="mb-2 text-xl font-semibold tracking-tight text-ink-display">
            {dragActive ? "Drop your file here" : "Upload document"}
          </div>
          <p className="text-center text-sm leading-relaxed text-ink-muted">
            Drag and drop or click to select
            <br />
            <span className="text-xs">PDF, DOCX, and XLSX are supported</span>
          </p>
        </label>
      </div>

      <label className="mt-4 flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-surface-line bg-white px-4 py-3">
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
            <ImageIcon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">
              Image descriptions
            </span>
            <span className="block text-xs leading-relaxed text-ink-muted">
              Annotate extracted figures and charts
            </span>
          </span>
        </span>
        <input
          type="checkbox"
          className="peer sr-only"
          checked={imageAnnotations}
          disabled={disabled}
          onChange={(event) => onImageAnnotationsChange(event.target.checked)}
          aria-label="Image descriptions"
        />
        <span
          aria-hidden="true"
          className="relative h-6 w-11 shrink-0 rounded-full bg-slate-300 transition-colors peer-checked:bg-indigo-600 peer-disabled:opacity-50 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-5"
        />
      </label>

      <label className="mt-3 flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-surface-line bg-white px-4 py-3">
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <Languages className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">
              Translate LOTE to English
            </span>
            <span className="block text-xs leading-relaxed text-ink-muted">
              Keep source Markdown and generate an English version
            </span>
          </span>
        </span>
        <input
          type="checkbox"
          className="peer sr-only"
          checked={translateToEnglish}
          disabled={disabled}
          onChange={(event) => onTranslateToEnglishChange(event.target.checked)}
          aria-label="Translate LOTE to English"
        />
        <span
          aria-hidden="true"
          className="relative h-6 w-11 shrink-0 rounded-full bg-slate-300 transition-colors peer-checked:bg-emerald-600 peer-disabled:opacity-50 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-5"
        />
      </label>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </Card>
  );
}

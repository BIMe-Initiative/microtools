"use client";

import { useCallback, useState } from "react";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface UploadZoneProps {
  onUpload: (file: File) => void;
  disabled?: boolean;
}

const MAX_SIZE = 100 * 1024 * 1024; // 100 MB

export function UploadZone({ onUpload, disabled }: UploadZoneProps) {
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
    <Card className="overflow-hidden p-5 sm:p-6">
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
        className={`relative rounded-lg border-2 border-dashed p-8 transition-all sm:p-12 ${dragActive
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
          className="flex flex-col items-center justify-center cursor-pointer"
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

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </Card>
  );
}

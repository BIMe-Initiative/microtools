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
    <Card className="p-8">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-lg p-12 transition-colors ${dragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25"
          } ${disabled ? "pointer-events-none opacity-50" : "cursor-pointer hover:border-primary"}`}
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
            <Upload className="w-16 h-16 text-primary mb-4" />
          ) : (
            <FileText className="w-16 h-16 text-muted-foreground mb-4" />
          )}
          <h3 className="text-xl font-semibold mb-2">
            {dragActive ? "Drop your file here" : "Upload Document"}
          </h3>
          <p className="text-sm text-muted-foreground text-center">
            Drag and drop or click to select
            <br />
            <span className="text-xs">Maximum size: 100 MB</span>
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

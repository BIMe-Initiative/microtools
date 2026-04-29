"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api, type JobStatus } from "@/lib/api";

interface ProcessingStatusProps {
  jobId: string;
  onComplete: () => void;
  onFailed: (error: string) => void;
}

export function ProcessingStatus({
  jobId,
  onComplete,
  onFailed,
}: ProcessingStatusProps) {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [indeterminateProgress, setIndeterminateProgress] = useState(10);
  const doneRef = useRef(false);

  useEffect(() => {
    doneRef.current = false;

    const poll = async () => {
      try {
        const s = await api.getJobStatus(jobId);
        setStatus(s);
        if (s.status === "completed" && !doneRef.current) {
          doneRef.current = true;
          onComplete();
        } else if (s.status === "failed" && !doneRef.current) {
          doneRef.current = true;
          onFailed(s.error ?? "Processing failed");
        }
      } catch {
        // will retry next interval
      }
    };

    poll();
    const id = setInterval(() => {
      if (!doneRef.current) poll();
    }, 2000);
    return () => clearInterval(id);
  }, [jobId, onComplete, onFailed]);

  useEffect(() => {
    if (status?.progress != null || status?.status === "completed" || status?.status === "failed") {
      return;
    }
    const id = setInterval(() => {
      setIndeterminateProgress((prev) => (prev >= 85 ? 15 : prev + 10));
    }, 600);
    return () => clearInterval(id);
  }, [status?.progress, status?.status]);

  const icon =
    status?.status === "completed" ? (
      <CheckCircle className="h-5 w-5 text-emerald-600" />
    ) : status?.status === "failed" ? (
      <XCircle className="h-5 w-5 text-red-500" />
    ) : (
      <Loader2 className="h-5 w-5 animate-spin text-brand-coral-press" />
    );

  const badgeVariant =
    status?.status === "failed"
      ? "destructive"
      : status?.status === "completed"
      ? "default"
      : "secondary";

  return (
    <Card className="overflow-hidden">
      <div className="h-[3px] bg-gradient-to-r from-brand-coral via-indigo-400 to-emerald-400" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-ink-display">
          {icon}
          Processing
          <Badge variant={badgeVariant} className="capitalize ml-auto">
            {status?.status ?? "uploading"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {status?.progress != null ? (
          <div className="space-y-1">
            <div className="flex justify-between text-sm text-ink-muted">
              <span>Progress</span>
              <span className="font-semibold text-ink">{status.progress}%</span>
            </div>
            <Progress value={status.progress} />
          </div>
        ) : status?.status !== "completed" && status?.status !== "failed" ? (
          <div className="space-y-1">
            <div className="flex justify-between text-sm text-ink-muted">
              <span>Progress</span>
              <span className="font-semibold text-ink">Processing...</span>
            </div>
            <Progress value={indeterminateProgress} />
          </div>
        ) : null}

        {status?.message && (
          <p className="text-sm text-ink-muted">{status.message}</p>
        )}

        {status?.error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{status.error}</AlertDescription>
          </Alert>
        )}

        <p className="text-xs text-ink-muted/70">Job ID: {jobId}</p>
      </CardContent>
    </Card>
  );
}

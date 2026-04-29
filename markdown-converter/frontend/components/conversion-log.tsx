"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, type JobLogItem } from "@/lib/api";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | JobLogItem["status"];

interface ConversionLogProps {
  refreshKey: number;
}

const statusStyles: Record<JobLogItem["status"], string> = {
  uploading: "border-sky-200 bg-sky-50 text-sky-800",
  processing: "border-indigo-200 bg-indigo-50 text-indigo-800",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  failed: "border-red-200 bg-red-50 text-red-800",
};

export function ConversionLog({ refreshKey }: ConversionLogProps) {
  const [jobs, setJobs] = useState<JobLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const loadJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getJobLog();
      setJobs(res.jobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load conversion log");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadJobs();
  }, [refreshKey]);

  const typeOptions = useMemo(() => {
    return Array.from(
      new Set(jobs.map((job) => normalizedType(job)).filter(Boolean))
    ).sort();
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return jobs.filter((job) => {
      const type = normalizedType(job);
      const matchesQuery =
        !normalizedQuery ||
        job.original_filename.toLowerCase().includes(normalizedQuery) ||
        job.job_id.toLowerCase().includes(normalizedQuery);
      const matchesStatus =
        statusFilter === "all" || job.status === statusFilter;
      const matchesType = typeFilter === "all" || type === typeFilter;
      return matchesQuery && matchesStatus && matchesType;
    });
  }, [jobs, query, statusFilter, typeFilter]);

  return (
    <section className="rounded-lg border border-surface-line bg-white shadow-[0_4px_16px_rgba(15,23,42,0.04)]">
      <div className="border-b border-surface-line px-5 py-5 sm:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-700">
              Conversion log
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink-display">
              Document history
            </h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_150px_130px_auto] lg:min-w-[720px]">
            <label className="relative block">
              <span className="sr-only">Search conversions</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted/70" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-10 w-full rounded-md border border-surface-line bg-white pl-9 pr-3 text-sm text-ink outline-none transition focus:border-brand-coral focus:ring-2 focus:ring-brand-coral/20"
                placeholder="Search filename or job ID"
              />
            </label>
            <label>
              <span className="sr-only">Filter by status</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
                className="h-10 w-full rounded-md border border-surface-line bg-white px-3 text-sm text-ink outline-none transition focus:border-brand-coral focus:ring-2 focus:ring-brand-coral/20"
              >
                <option value="all">All statuses</option>
                <option value="completed">Completed</option>
                <option value="processing">Processing</option>
                <option value="uploading">Uploading</option>
                <option value="failed">Failed</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Filter by type</span>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="h-10 w-full rounded-md border border-surface-line bg-white px-3 text-sm text-ink outline-none transition focus:border-brand-coral focus:ring-2 focus:ring-brand-coral/20"
              >
                <option value="all">All types</option>
                {typeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              variant="outline"
              onClick={loadJobs}
              disabled={loading}
              aria-label="Refresh conversion log"
              title="Refresh conversion log"
              className="rounded-md px-3"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="px-5 pt-5 sm:px-8">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-surface-line bg-surface-muted text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            <tr>
              <th className="px-5 py-3 sm:pl-8">Document</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 sm:pr-8">Links</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-line">
            {loading && jobs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-ink-muted">
                  Loading conversion log...
                </td>
              </tr>
            )}
            {!loading && filteredJobs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-ink-muted">
                  No conversions match the current filters.
                </td>
              </tr>
            )}
            {filteredJobs.map((job) => (
              <tr key={job.job_id} className="align-top hover:bg-surface-muted/60">
                <td className="max-w-[360px] px-5 py-4 sm:pl-8">
                  <div className="truncate font-semibold text-ink-display">
                    {job.original_filename}
                  </div>
                  <div className="mt-1 truncate font-mono text-xs text-ink-muted">
                    {job.job_id}
                  </div>
                  {job.error && (
                    <div className="mt-2 line-clamp-2 text-xs text-red-700">
                      {job.error}
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 text-ink-muted">
                  {normalizedType(job)}
                </td>
                <td className="px-4 py-4 text-ink-muted">
                  {formatBytes(job.original_file_size)}
                </td>
                <td className="px-4 py-4 text-ink-muted">
                  <div>{formatDate(job.created_at)}</div>
                  {job.completed_at && (
                    <div className="mt-1 text-xs">
                      Done {formatDate(job.completed_at)}
                    </div>
                  )}
                </td>
                <td className="px-4 py-4">
                  <Badge
                    variant="outline"
                    className={cn(
                      "capitalize",
                      statusStyles[job.status] ?? "border-surface-line"
                    )}
                  >
                    {job.status}
                  </Badge>
                </td>
                <td className="px-4 py-4 sm:pr-8">
                  <div className="flex flex-wrap gap-2">
                    <DocumentLink
                      href={api.documentUrl("source", job.job_id)}
                      disabled={!job.source_available}
                      label="Source"
                      icon={<FileText className="h-3.5 w-3.5" />}
                    />
                    <DocumentLink
                      href={api.documentUrl("output", job.job_id)}
                      disabled={!job.markdown_available}
                      label="Markdown"
                      icon={<ExternalLink className="h-3.5 w-3.5" />}
                    />
                    <DocumentLink
                      href={api.documentUrl("download", job.job_id)}
                      disabled={!job.archive_available}
                      label="ZIP"
                      icon={<Archive className="h-3.5 w-3.5" />}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DocumentLink({
  href,
  disabled,
  label,
  icon,
}: {
  href: string;
  disabled: boolean;
  label: string;
  icon: ReactNode;
}) {
  if (disabled) {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-surface-line bg-surface-muted px-2.5 text-xs font-semibold text-ink-muted/60">
        {icon}
        {label}
      </span>
    );
  }

  return (
    <a
      href={href}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-surface-line bg-white px-2.5 text-xs font-semibold text-ink hover:border-brand-coral/70 hover:bg-brand-coral-tint/60 hover:text-brand-coral-press"
    >
      {label === "ZIP" ? <Download className="h-3.5 w-3.5" /> : icon}
      {label}
    </a>
  );
}

function normalizedType(job: JobLogItem): string {
  return job.file_type?.toUpperCase() || "UNKNOWN";
}

function formatBytes(size?: number | null): string {
  if (typeof size !== "number") return "Unknown";
  if (size < 1024) return `${size} B`;
  const units = ["KB", "MB", "GB"];
  let value = size / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

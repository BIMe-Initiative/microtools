"use client";

import { useState } from "react";
import { Download, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/lib/api";

interface ActionButtonsProps {
  jobId: string;
}

export function ActionButtons({ jobId }: ActionButtonsProps) {
  const [downloading, setDownloading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [prompt, setPrompt] = useState(
    "Summarize this document and extract key insights."
  );
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      setError(null);
      await api.downloadResult(jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const handleAnalyze = async () => {
    try {
      setAnalyzing(true);
      setError(null);
      setAnalysis(null);
      const result = await api.analyzeDocument(jobId, prompt);
      setAnalysis(result.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={handleDownload}
          disabled={downloading}
          className="w-full"
          size="lg"
        >
          {downloading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Download for Obsidian (.zip)
        </Button>

        <div className="space-y-2">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter analysis prompt..."
            rows={3}
          />
          <Button
            onClick={handleAnalyze}
            disabled={analyzing || !prompt.trim()}
            variant="secondary"
            className="w-full"
          >
            {analyzing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Send to Vertex AI
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {analysis && (
          <Alert>
            <AlertDescription className="whitespace-pre-wrap max-h-[400px] overflow-auto">
              {analysis}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

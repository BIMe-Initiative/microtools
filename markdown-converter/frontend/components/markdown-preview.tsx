"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import "katex/dist/katex.min.css";

interface MarkdownPreviewProps {
  markdown: string;
}

export function MarkdownPreview({ markdown }: MarkdownPreviewProps) {
  const [tab, setTab] = useState("preview");

  return (
    <Card className="h-full overflow-hidden">
      <div className="h-[3px] bg-gradient-to-r from-sky-500 via-indigo-400 to-transparent" />
      <CardHeader>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
          Markdown output
        </div>
        <CardTitle className="text-lg text-ink-display">Document Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preview">Rendered</TabsTrigger>
            <TabsTrigger value="raw">Raw Markdown</TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="mt-4">
            <div className="prose max-h-[600px] max-w-none overflow-auto rounded-lg border border-surface-line bg-white p-4 text-ink dark:prose-invert">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  code({ className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || "");
                    const inline = !match;
                    return !inline ? (
                      <SyntaxHighlighter
                        style={vscDarkPlus}
                        language={match![1]}
                        PreTag="div"
                      >
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {markdown}
              </ReactMarkdown>
            </div>
          </TabsContent>

          <TabsContent value="raw" className="mt-4">
            <div className="max-h-[600px] overflow-auto rounded-lg border border-surface-line bg-surface-sunk p-4">
              <pre className="whitespace-pre-wrap font-mono text-sm text-ink">
                {markdown}
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

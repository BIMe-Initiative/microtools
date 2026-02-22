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
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">Document Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preview">Rendered</TabsTrigger>
            <TabsTrigger value="raw">Raw Markdown</TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="mt-4">
            <div className="prose dark:prose-invert max-w-none overflow-auto max-h-[600px] p-4 border rounded-md">
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
            <div className="bg-muted rounded-md p-4 overflow-auto max-h-[600px]">
              <pre className="text-sm font-mono whitespace-pre-wrap">
                {markdown}
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

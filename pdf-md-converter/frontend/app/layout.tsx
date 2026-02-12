import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ModeToggle } from "@/components/mode-toggle";

export const metadata: Metadata = {
  title: "PDF to Markdown Converter",
  description:
    "Convert PDFs to Obsidian-compatible Markdown using Mistral OCR",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="min-h-screen bg-background">
            <header className="border-b">
              <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold">PDF to Markdown</h1>
                  <p className="text-sm text-muted-foreground">
                    Powered by Mistral OCR
                  </p>
                </div>
                <ModeToggle />
              </div>
            </header>

            <main className="container mx-auto px-4 py-8">{children}</main>

            <footer className="border-t mt-12">
              <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
                <p>BIMei Microtools Collection</p>
                <p className="text-xs mt-1">
                  Licensed under CC BY-NC-SA 4.0
                </p>
              </div>
            </footer>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}

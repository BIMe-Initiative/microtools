import type { Metadata } from "next";
import { Raleway, JetBrains_Mono, PT_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Footer } from "@/components/ui/Footer";

const raleway = Raleway({
  variable: "--font-raleway",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const ptSans = PT_Sans({
  variable: "--font-pt-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "BIMei Markdown Converter",
  description:
    "Convert PDFs, DOCX, and XLSX files to Obsidian-compatible Markdown using Mistral OCR",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${raleway.variable} ${jetbrainsMono.variable} ${ptSans.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full bg-white text-ink">
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
        <div className="flex min-h-screen flex-col bg-surface-muted text-ink">
          <header className="border-b border-surface-line bg-white/90 backdrop-blur">
            <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-coral-press">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-coral" />
                  BIMei Microtools
                </div>
                <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink-display sm:text-2xl">
                  BIMei Markdown Converter
                </h1>
                <p className="text-sm text-ink-muted">Powered by Mistral OCR</p>
              </div>
            </div>
          </header>

          <main className="container mx-auto flex-1 px-4 py-8 sm:py-10">{children}</main>

          <Footer />
        </div>
      </body>
    </html>
  );
}

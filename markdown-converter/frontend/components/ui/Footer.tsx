import Link from "next/link";
import type { ComponentType, SVGProps } from "react";

function LinkedinFill(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M4.98 3.5C4.98 4.88 3.9 6 2.5 6S0 4.88 0 3.5 1.08 1 2.5 1 4.98 2.12 4.98 3.5ZM.16 8.16h4.68V23H.16V8.16Zm7.59 0h4.48v2.03h.06c.62-1.17 2.15-2.4 4.43-2.4 4.73 0 5.6 3.12 5.6 7.17V23h-4.68v-7.17c0-1.71-.03-3.92-2.39-3.92-2.4 0-2.77 1.87-2.77 3.8V23H7.75V8.16Z"
      />
    </svg>
  );
}

function YoutubeFill(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M23.5 6.2s-.23-1.64-.95-2.36C21.6 3 20.6 3 20.1 2.93 16.8 2.7 12 2.7 12 2.7h-.01s-4.8 0-8.09.23C3.4 3 2.4 3 1.45 3.84.73 4.56.5 6.2.5 6.2S.27 8.06.27 9.92v1.72c0 1.86.23 3.72.23 3.72s.23 1.64.95 2.36c.95.84 2.2.81 2.76.9 2 .22 8 .23 8 .23s4.81-.01 8.1-.23c.49-.06 1.49-.07 2.44-.91.72-.72.95-2.36.95-2.36s.23-1.86.23-3.72V9.92c0-1.86-.23-3.72-.23-3.72ZM9.8 13.92V7.92l5.46 3-5.46 3Z"
      />
    </svg>
  );
}

type FooterNavLink = {
  label: string;
  href: string;
};

type FooterSocialLink = FooterNavLink & {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const navLinks: FooterNavLink[] = [
  { label: "Contact Us", href: "http://bimexcellence.org/contact/" },
  { label: "Subscribe", href: "https://bimexcellence.org/subscribe/" },
  { label: "Privacy", href: "https://bimexcellence.org/privacy/" },
  { label: "Terms", href: "https://bimexcellence.org/terms/" },
  { label: "Home", href: "https://bimexcellence.org/projects/" },
];

const socialLinks: FooterSocialLink[] = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/bim-excellence",
    icon: LinkedinFill,
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/c/Bimframeworks",
    icon: YoutubeFill,
  },
];

export function Footer({ className }: { className?: string }) {
  return (
    <footer
      className={
        "mt-auto bg-[#ef8b7b] text-white shadow-[0_-6px_24px_rgba(0,0,0,0.08)]" +
        (className ? ` ${className}` : "")
      }
      role="contentinfo"
    >
      <div
        className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-6 text-center md:flex-row md:items-center md:justify-start md:gap-8 md:text-left"
        style={{ fontFamily: "var(--font-raleway), var(--font-sans), sans-serif" }}
        data-term-autolink-ignore="true"
      >
        <div className="flex flex-wrap items-center justify-center gap-3 text-[12px] font-semibold uppercase tracking-[0.18em] md:justify-start">
          <Link
            href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.en"
            prefetch={false}
            target="_blank"
            rel="noreferrer"
            aria-label="Creative Commons Attribution-NonCommercial-ShareAlike 4.0"
            className="flex items-center"
          >
            <img
              src="https://bimexcellence.org/wp-content/uploads/cc-logo_white.png"
              alt="Creative Commons"
              className="h-9 w-auto"
              width={120}
              height={36}
            />
          </Link>
          <div className="ml-1 flex items-center gap-2">
            {socialLinks.map((social) => {
              const Icon = social.icon;
              return (
                <Link
                  key={social.label}
                  href={social.href}
                  prefetch={false}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Follow us on ${social.label}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </div>

        <div
          className="uppercase flex flex-col text-center md:text-left md:items-start"
          style={{
            fontFamily: "var(--font-raleway), var(--font-sans), sans-serif",
            fontSize: "9.6px",
            fontStyle: "normal",
            fontWeight: 400,
            letterSpacing: "0.96px",
            lineHeight: "1.6",
            textAlign: "left",
            height: "auto",
          }}
        >
          <span>BIMe Initiative by:</span>
          <span>CHANGE AGENTS AEC</span>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-4 text-[16px] font-semibold uppercase tracking-[0.12em] md:justify-end md:text-right md:ml-auto">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              prefetch={false}
              target="_blank"
              rel="noreferrer"
              className="transition hover:opacity-80"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}

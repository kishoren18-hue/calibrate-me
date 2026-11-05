import "@fontsource-variable/fraunces";

import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import Link from "next/link";

import { AuthButton } from "@/components/auth-button";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Calibrate Me: do you know what you know?", template: "%s · Calibrate Me" },
  description:
    "A short game that measures whether your confidence is honest, with classroom dashboards for teachers and a comparison with Claude.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
};

const nav = [
  { href: "/", label: "Play" },
  { href: "/join", label: "Join a class" },
  { href: "/vs-claude", label: "Humans vs. Claude" },
  { href: "/teach", label: "For teachers" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} theme-warm`}>
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
          Skip to content
        </a>
        <header className="border-b border-line">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
            <Link href="/" className="font-serif text-lg font-semibold">
              Calibrate Me
            </Link>
            <nav aria-label="Main" className="hidden gap-1 text-sm md:flex">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-md px-3 py-1.5 text-muted hover:bg-surface-2 hover:text-ink">
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto">
              <AuthButton />
            </div>
          </div>
          <nav aria-label="Main mobile" className="flex gap-1 overflow-x-auto px-3 pb-2 text-sm md:hidden">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="shrink-0 rounded-md px-3 py-1 text-muted hover:bg-surface-2">
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <div id="main" className="flex-1">
          {children}
        </div>
        <footer className="py-6 text-center text-xs text-muted">
          Calibrate Me · open source ·{" "}
          <a className="underline hover:text-ink" href="https://github.com/kishoren18-hue/calibrate-me">
            source
          </a>
        </footer>
      </body>
    </html>
  );
}

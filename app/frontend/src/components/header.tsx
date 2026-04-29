"use client";

import Link from "next/link";

import { StepBadge } from "@/components/icons";

export function AppHeader({
  step,
  filename,
  fileId,
  downloadHref,
  backHref,
}: {
  step: 1 | 2 | 3;
  filename?: string;
  fileId?: string;
  downloadHref?: string;
  backHref?: string;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-[#eceae7] bg-white/88 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-border-subtle bg-white p-2 shadow-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" />
            <span className="h-2.5 w-2.5 rounded-full bg-teal" />
            <span className="h-2.5 w-2.5 rounded-full bg-violet" />
            <span className="h-2.5 w-2.5 rounded-full bg-blue" />
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <div className="font-medium tracking-tight"><span className="text-accent">Calc</span>Sense</div>
              <div className="truncate text-xs uppercase tracking-[0.22em] text-text-tertiary">AI Workbook Intelligence</div>
            </div>
            <span className="hidden rounded-full border border-border-subtle bg-white px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-text-tertiary md:inline-flex">
              v1.0 · Beta
            </span>
          </div>
        </div>
        <div className="order-3 flex w-full justify-center gap-3 sm:order-none sm:w-auto">
          {[1, 2, 3].map((n) => (
            <StepBadge key={n} n={n} active={step >= n} />
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-sm text-text-secondary sm:gap-3">
          <a
            href="https://www.linkedin.com/in/gogul-kumar-mathi-86079a148"
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-full border border-border-subtle px-3 py-2 hover:text-accent md:inline-flex"
          >
            Built by Gogul Kumar Mathi
          </a>
          {filename ? <span className="hidden max-w-[220px] truncate font-mono-ui md:inline-flex">{filename}</span> : null}
          {backHref ? <Link href={backHref} className="rounded-full border border-border-subtle px-3 py-2 hover:text-accent">Back to sheets</Link> : null}
          {downloadHref ? <a href={downloadHref} className="rounded-full border border-border-subtle px-3 py-2 hover:text-accent">Download</a> : null}
          {fileId ? <Link href="/" className="rounded-full bg-accent px-3 py-2 text-white hover:bg-accent-dim">New workbook</Link> : null}
        </div>
      </div>
    </header>
  );
}

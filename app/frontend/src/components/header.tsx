"use client";

import Link from "next/link";

import { StepBadge } from "@/components/icons";

export function AppHeader({
  step,
  filename,
  fileId,
}: {
  step: 1 | 2 | 3;
  filename?: string;
  fileId?: string;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle/80 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-border-subtle bg-white p-2 shadow-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" />
            <span className="h-2.5 w-2.5 rounded-full bg-teal" />
            <span className="h-2.5 w-2.5 rounded-full bg-violet" />
            <span className="h-2.5 w-2.5 rounded-full bg-blue" />
          </div>
          <div>
            <div className="font-medium tracking-tight">Formula Tracer</div>
            <div className="text-xs uppercase tracking-[0.22em] text-text-tertiary">Excel Intelligence</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {[1, 2, 3].map((n) => (
            <StepBadge key={n} n={n} active={step >= n} />
          ))}
        </div>
        <div className="flex items-center gap-4 text-sm text-text-secondary">
          {filename ? <span className="font-mono-ui">{filename}</span> : null}
          {fileId ? <Link href="/" className="text-accent hover:text-accent-dim">Start over</Link> : null}
        </div>
      </div>
    </header>
  );
}

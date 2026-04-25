"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { AppHeader } from "@/components/header";
import { deleteFileEntry, fetchRegistry, uploadFile } from "@/lib/api";
import type { FileEntry } from "@/lib/types";

const FEATURE_STEPS = [
  {
    number: "01",
    title: "Upload workbook",
    body: "Bring in a live .xlsx model and preserve sheet structure, formulas, and values for analysis.",
  },
  {
    number: "02",
    title: "Trace dependencies",
    body: "Follow every metric back to base inputs across sheets, ranges, and intermediate calculations.",
  },
  {
    number: "03",
    title: "Explain the logic",
    body: "Generate analyst-ready and business-ready summaries that turn workbook structure into narrative.",
  },
];

function HeroVisual() {
  return (
    <div className="relative overflow-hidden rounded-[42px] border border-white/70 bg-white/95 p-4 shadow-[0_32px_90px_rgba(34,32,28,0.08)] lg:p-6">
      <div className="pointer-events-none absolute -left-10 top-14 h-28 w-28 rounded-full bg-teal/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-6 right-4 h-40 w-40 rounded-full bg-violet/10 blur-3xl" />
      <div className="relative rounded-[34px] border border-border-subtle bg-[linear-gradient(180deg,#fbfaf8_0%,#f5f2ed_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        <div className="flex items-center justify-between rounded-[24px] border border-border-subtle bg-white/80 px-4 py-3 shadow-sm">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-text-tertiary">Live Workbook Session</div>
            <div className="mt-1 text-base font-semibold tracking-tight">FY24 Operating Model</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-bg-tint px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-accent">Summary!B4</span>
            <span className="rounded-full border border-border-subtle px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-text-secondary">Mapped</span>
          </div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="rounded-[28px] border border-border-subtle bg-white/70 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-[0.24em] text-text-tertiary">Workbook Grid</div>
              <div className="rounded-full border border-border-subtle bg-white px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-text-secondary">Sheet Preview</div>
            </div>
            <div className="grid grid-cols-5 gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-text-tertiary">
              {["Metric", "Q1 Act", "Q2 Act", "Q3 Fcst", "FY Fct"].map((item) => <div key={item}>{item}</div>)}
            </div>
            {[
              ["Revenue", "120", "130", "140", "390"],
              ["COGS", "40", "43", "45", "128"],
              ["Gross Profit", "=B2-B3", "=C2-C3", "=D2-D3", "=SUM(B4:D4)"],
              ["OpEx", "18", "19", "20", "57"],
              ["EBITDA", "=B4-B5", "=C4-C5", "=D4-D5", "=SUM(B6:D6)"],
            ].map((row, rowIndex) => (
              <div key={row[0]} className="mt-2 grid grid-cols-5 gap-2">
                {row.map((value, colIndex) => (
                  <div
                    key={`${row[0]}-${colIndex}`}
                    className={`rounded-2xl border px-3 py-2.5 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ${
                      rowIndex === 4 && colIndex === 4
                        ? "animate-pulse-soft border-accent bg-teal/10 ring-2 ring-accent/25"
                        : rowIndex >= 2
                          ? "border-border-subtle bg-white/90 font-mono-ui"
                          : "border-border-subtle bg-white/90"
                    }`}
                  >
                    {value}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-[28px] border border-accent/15 bg-[linear-gradient(180deg,#f4faf8_0%,#eef6f4_100%)] p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-[0.24em] text-accent">Formula Trace</div>
                <div className="rounded-full border border-accent/15 bg-white/80 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-accent">Cross-sheet lineage</div>
              </div>
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 360 260" fill="none">
                <path d="M128 72 C128 102, 128 118, 160 138" stroke="#8EBBB6" strokeWidth="2" strokeDasharray="6 6" className="animate-dash-flow" />
                <path d="M176 154 C176 178, 176 192, 212 214" stroke="#B6A6F6" strokeWidth="2" strokeDasharray="6 6" className="animate-dash-flow" />
              </svg>
              <div className="relative space-y-3 text-sm">
                <div className="rounded-[22px] border border-accent/45 bg-white p-4 font-mono-ui shadow-sm">Summary!B4 = Profit</div>
                <div className="pl-8">
                  <div className="rounded-[22px] border border-teal/45 bg-white p-4 font-mono-ui shadow-sm">Revenue - Expenses</div>
                </div>
                <div className="pl-14">
                  <div className="rounded-[22px] border border-violet/45 bg-white p-4 font-mono-ui shadow-sm">Regional totals and operating costs</div>
                </div>
              </div>
            </div>
            <div className="rounded-[28px] border border-border-subtle bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-text-tertiary">AI Narrative</div>
                  <div className="mt-1 text-base font-semibold tracking-tight">Operating profit bridge</div>
                </div>
                <div className="rounded-full bg-bg-tint px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-accent">Streaming</div>
              </div>
              <p className="mt-3 text-sm leading-6 text-text-secondary">
                The platform explains how profit is constructed, identifies the base drivers behind each step, and turns spreadsheet logic into documentation that teams can review quickly.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[20px] border border-border-subtle bg-bg-deep p-4">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-text-tertiary">Analyst</div>
                  <div className="mt-2 text-sm leading-6 text-text-secondary">Methodology, dependency depth, formula structure, and audit-ready lineage.</div>
                </div>
                <div className="rounded-[20px] border border-border-subtle bg-bg-deep p-4">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-text-tertiary">Business</div>
                  <div className="mt-2 text-sm leading-6 text-text-secondary">Plain-English summaries for leaders who need meaning, not spreadsheet syntax.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [recentFiles, setRecentFiles] = useState<FileEntry[]>([]);
  const [progress, setProgress] = useState("Drop an .xlsx workbook here or click upload to begin.");
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    void fetchRegistry().then(setRecentFiles).catch(() => undefined);
  }, []);

  async function handleFile(file: File) {
    setError(null);
    await uploadFile(file, {
      onProgress: (message) => setProgress(message),
      onDone: (payload) => router.push(`/workbook/${payload.file_id}`),
    }).catch((err) => setError(err instanceof Error ? err.message : "Upload failed"));
  }

  return (
    <main
      className="min-h-screen bg-bg-deep"
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file) void handleFile(file);
      }}
    >
      <AppHeader step={1} />
      {isDragging ? (
        <div className="pointer-events-none fixed inset-0 z-40 bg-accent/8 p-6 backdrop-blur-sm">
          <div className="flex h-full items-center justify-center rounded-[36px] border-2 border-dashed border-accent/45 bg-white/80">
            <div className="rounded-[28px] bg-white px-8 py-6 text-center shadow-xl">
              <div className="text-xs uppercase tracking-[0.24em] text-accent">Drop workbook to upload</div>
              <div className="mt-3 text-lg font-medium">Release your `.xlsx` file to begin tracing</div>
            </div>
          </div>
        </div>
      ) : null}
      <div className="mx-auto max-w-7xl px-6 pb-20 pt-10">
        <section className="grid items-start gap-12 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="pt-4">
            <div className="inline-flex rounded-full border border-border-subtle bg-white/90 px-4 py-2 text-sm text-text-secondary shadow-sm">
              Built for workbook reviews, audit trails, and model handoffs
            </div>
            <div className="mt-7 flex items-center gap-3">
              <span className="rounded-full bg-accent px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-white">Step 1</span>
              <span className="text-[11px] uppercase tracking-[0.24em] text-text-tertiary">Upload, trace, explain, optimize</span>
            </div>
            <h1 className="mt-5 max-w-3xl font-serif-display text-6xl leading-none tracking-tight lg:text-7xl">
              See what&apos;s behind every number in your model
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-text-secondary">
              Upload an Excel workbook to trace formulas down to their source values, visualize dependency chains, and generate analyst-grade explanations.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <button className="rounded-2xl bg-accent px-6 py-4 text-white shadow-[0_14px_30px_rgba(15,118,110,0.22)] transition hover:-translate-y-0.5 hover:bg-accent-dim" onClick={() => inputRef.current?.click()}>
                Upload Workbook
              </button>
              <div className="min-w-[280px] rounded-2xl border border-border-subtle bg-white/90 px-5 py-4 text-sm text-text-secondary shadow-sm">{progress}</div>
            </div>
            {error ? <div className="mt-4 rounded-2xl border border-rose bg-rose/5 px-4 py-3 text-sm text-rose">{error}</div> : null}
            <div className="mt-10 grid gap-4">
              {FEATURE_STEPS.map((step, index) => (
                <div
                  key={step.number}
                  className="animate-fade-in-up grid gap-3 rounded-[26px] border border-border-subtle bg-white/80 p-4 shadow-sm md:grid-cols-[68px_1fr]"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-bg-tint font-mono-ui text-sm text-accent">{step.number}</div>
                  <div>
                    <div className="text-base font-semibold tracking-tight">{step.title}</div>
                    <p className="mt-1 text-sm leading-6 text-text-secondary">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </div>
          <HeroVisual />
        </section>

        <section className="mt-16">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-text-tertiary">Workspace</div>
              <h2 className="mt-2 text-2xl font-medium tracking-tight">Recent files</h2>
            </div>
            <div className="rounded-full border border-border-subtle bg-white px-4 py-2 text-sm text-text-secondary">
              {recentFiles.length} workbook{recentFiles.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recentFiles.map((file) => (
              <div key={file.file_id} className="animate-fade-in-up rounded-[30px] border border-border-subtle bg-white/90 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(0,0,0,0.06)]">
                <button className="w-full text-left" onClick={() => router.push(`/workbook/${file.file_id}`)}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium tracking-tight">{file.filename}</div>
                      <div className="mt-2 text-sm text-text-secondary">{file.sheets.length} sheets ready for analysis</div>
                    </div>
                    <div className="rounded-full bg-bg-tint px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-accent">Open</div>
                  </div>
                </button>
                <div className="mt-4 flex flex-wrap gap-2">
                  {file.sheets.slice(0, 3).map((sheet) => (
                    <span key={sheet} className="rounded-full border border-border-subtle bg-bg-deep px-3 py-1 text-xs text-text-secondary">
                      {sheet}
                    </span>
                  ))}
                </div>
                <button
                  className="mt-5 rounded-full border border-border-subtle px-3 py-2 text-sm text-text-secondary transition hover:border-rose hover:text-rose"
                  onClick={async () => {
                    await deleteFileEntry(file.file_id);
                    setRecentFiles((current) => current.filter((item) => item.file_id !== file.file_id));
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

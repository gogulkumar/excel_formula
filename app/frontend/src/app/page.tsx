"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { AppHeader } from "@/components/header";
import { deleteFileEntry, fetchBackendStatus, fetchRegistry, uploadFile } from "@/lib/api";
import type { BackendStatus, FileEntry } from "@/lib/types";

const FEATURE_STEPS = [
  {
    number: "01",
    title: "Upload workbook",
    body: "Bring in a live .xlsx model, preserve formulas and values, and get immediate workbook-ready context.",
  },
  {
    number: "02",
    title: "Trace dependencies",
    body: "Follow every metric through cross-sheet references, helper tabs, ranges, and intermediate checkpoints.",
  },
  {
    number: "03",
    title: "Explain and edit",
    body: "Generate analyst-grade explanations, ask workbook questions, insert charts, and apply Excel edits in place.",
  },
];

const STAGES = [
  { key: "drop", label: "Drop", duration: 2400 },
  { key: "scan", label: "Scan", duration: 3000 },
  { key: "trace", label: "Trace", duration: 3400 },
  { key: "explain", label: "Explain", duration: 4200 },
  { key: "chat", label: "Chat", duration: 5200 },
] as const;

function AIBadge() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-accent/15 bg-white/80 px-4 py-2 text-sm shadow-sm">
      <span className="animate-sparkle text-accent">✦</span>
      <span className="bg-[linear-gradient(90deg,#0F766E_0%,#7C3AED_50%,#0F766E_100%)] bg-[length:200%_100%] bg-clip-text text-transparent animate-ai-shimmer-text">
        AI Powered
      </span>
    </div>
  );
}

function StageDrop() {
  return (
    <div className="stage-enter relative h-[430px] overflow-hidden rounded-[36px] border border-border-subtle bg-white/90 p-5 shadow-[0_24px_80px_rgba(28,27,25,0.08)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(15,118,110,0.08),transparent_35%),radial-gradient(circle_at_80%_15%,rgba(124,58,237,0.08),transparent_30%),linear-gradient(180deg,#fff_0%,#f7f3ee_100%)]" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between">
          <div>
            <div className="eyebrow">Drag and drop</div>
            <div className="mt-2 text-lg font-semibold tracking-tight">Drop an operating model into CalcSense</div>
          </div>
          <div className="rounded-full border border-border-subtle bg-white px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-text-secondary">
            Stage 1
          </div>
        </div>
        <div className="relative mt-8 flex-1 overflow-hidden rounded-[30px] border border-dashed border-accent/35 bg-[linear-gradient(180deg,rgba(15,118,110,0.04),rgba(124,58,237,0.02))] p-6">
          <div className="absolute inset-0 bg-[linear-gradient(transparent_95%,rgba(208,206,201,0.55)_95%),linear-gradient(90deg,transparent_95%,rgba(208,206,201,0.55)_95%)] bg-[size:44px_44px] opacity-50" />
          <div className="zone-flash absolute inset-8 rounded-[24px] border border-accent/25" />
          <div className="ripple-1 absolute left-1/2 top-[63%] h-18 w-18 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/25" />
          <div className="ripple-2 absolute left-1/2 top-[63%] h-18 w-18 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/20" />
          <div className="ghost-drop absolute left-[18%] top-[16%] rounded-2xl border border-border-subtle bg-white px-4 py-3 font-mono-ui text-xs shadow-lg">
            FY24_Operating_Model.xlsx
          </div>
          <div className="cursor-fly absolute left-[12%] top-[14%] text-xl">⌁</div>
          <div className="confirm-rise absolute left-1/2 top-[64%] -translate-x-1/2 rounded-full bg-accent px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-white shadow-lg">
            Upload queued
          </div>
          <div className="relative flex h-full items-end justify-between">
            <div className="max-w-[260px] rounded-[24px] bg-white/90 p-5 shadow-sm">
              <div className="eyebrow">Workbook intake</div>
              <div className="mt-2 text-sm leading-6 text-text-secondary">
                Bring in structured Excel models with formulas, assumptions, helper tabs, and reporting sheets intact.
              </div>
            </div>
            <div className="upload-invite rounded-[24px] border border-accent/20 bg-white px-5 py-4 text-sm font-medium text-accent shadow-sm">
              Drop workbook here
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StageScan() {
  return (
    <div className="stage-enter relative h-[430px] overflow-hidden rounded-[36px] border border-border-subtle bg-white/90 p-5 shadow-[0_24px_80px_rgba(28,27,25,0.08)]">
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">Scanning workbook</div>
          <div className="mt-2 text-lg font-semibold tracking-tight">Reading formulas, values, and table regions</div>
        </div>
        <div className="rounded-full bg-bg-tint px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-accent">Stage 2</div>
      </div>
      <div className="relative mt-8 overflow-hidden rounded-[30px] border border-border-subtle bg-[linear-gradient(180deg,#fbfaf7_0%,#f4f0ea_100%)] p-5">
        <div className="scan-sweep absolute inset-y-0 left-0 w-24 bg-[linear-gradient(90deg,transparent,rgba(15,118,110,0.18),transparent)]" />
        <div className="grid grid-cols-5 gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-text-tertiary">
          {["Metric", "Q1", "Q2", "Q3", "FY"].map((item) => <div key={item}>{item}</div>)}
        </div>
        {[
          ["Revenue", "120", "130", "140", "=SUM(B2:D2)"],
          ["COGS", "40", "43", "45", "=SUM(B3:D3)"],
          ["Gross Profit", "=B2-B3", "=C2-C3", "=D2-D3", "=SUM(B4:D4)"],
          ["OpEx", "18", "19", "20", "=SUM(B5:D5)"],
          ["EBITDA", "=B4-B5", "=C4-C5", "=D4-D5", "=SUM(B6:D6)"],
        ].map((row, rowIndex) => (
          <div key={row[0]} className="mt-2 grid grid-cols-5 gap-2">
            {row.map((value, colIndex) => (
              <div
                key={`${row[0]}-${colIndex}`}
                className={`rounded-2xl border px-3 py-2.5 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ${
                  colIndex === 4 || rowIndex >= 2 ? "border-accent/20 bg-accent/6 font-mono-ui" : "border-border-subtle bg-white/90"
                }`}
              >
                {value}
              </div>
            ))}
          </div>
        ))}
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {[
            ["Sheets", "8 loaded"],
            ["Formulas", "214 indexed"],
            ["Tables", "6 regions found"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-border-subtle bg-white/90 px-4 py-3 shadow-sm">
              <div className="text-[11px] uppercase tracking-[0.18em] text-text-tertiary">{label}</div>
              <div className="mt-1 font-mono-ui text-sm">{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StageTree() {
  const nodes = [
    { id: "1", label: "Summary!B4", x: "42%", y: "8%" },
    { id: "2", label: "Profit", x: "18%", y: "34%" },
    { id: "3", label: "Revenue", x: "61%", y: "34%" },
    { id: "4", label: "Regional totals", x: "10%", y: "64%" },
    { id: "5", label: "Operating costs", x: "58%", y: "64%" },
  ];
  return (
    <div className="stage-enter relative h-[430px] overflow-hidden rounded-[36px] border border-border-subtle bg-white/90 p-5 shadow-[0_24px_80px_rgba(28,27,25,0.08)]">
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">Tracing</div>
          <div className="mt-2 text-lg font-semibold tracking-tight">Follow the dependency chain across sheets</div>
        </div>
        <div className="rounded-full bg-bg-tint px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-accent">Stage 3</div>
      </div>
      <div className="relative mt-8 h-[320px] overflow-hidden rounded-[30px] border border-border-subtle bg-[linear-gradient(180deg,#f4faf8_0%,#eef5f3_100%)]">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 700 360" fill="none">
          <path d="M350 58 L350 118 L180 118 L180 160" stroke="#0F766E" strokeWidth="2.5" />
          <path d="M350 58 L350 118 L515 118 L515 160" stroke="#0F766E" strokeWidth="2.5" />
          <path d="M180 204 L180 242 L110 242 L110 278" stroke="#2563EB" strokeWidth="2.5" opacity="0.55" />
          <path d="M515 204 L515 242 L515 242 L515 278" stroke="#7C3AED" strokeWidth="2.5" opacity="0.55" />
        </svg>
        {nodes.map((node, index) => (
          <div
            key={node.id}
            className="tree-node-pop absolute rounded-[22px] border border-white bg-white/95 px-4 py-3 font-mono-ui text-sm shadow-[0_12px_30px_rgba(0,0,0,0.08)]"
            style={{ left: node.x, top: node.y, animationDelay: `${index * 160}ms` }}
          >
            {node.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function StageExplain() {
  return (
    <div className="stage-enter relative h-[430px] overflow-hidden rounded-[36px] border border-border-subtle bg-white/90 p-5 shadow-[0_24px_80px_rgba(28,27,25,0.08)]">
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">Explanation</div>
          <div className="mt-2 text-lg font-semibold tracking-tight">Generate technical and executive narratives</div>
        </div>
        <div className="rounded-full bg-bg-tint px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-accent">Stage 4</div>
      </div>
      <div className="mt-8 grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-[30px] border border-accent/15 bg-accent/5 p-5">
          <div className="eyebrow text-accent">Technical view</div>
          <div className="mt-4 space-y-3 text-sm text-text-secondary">
            <div className="typewriter rounded-2xl bg-white px-4 py-3 shadow-sm">Metric identity: Operating profit bridge on the Summary sheet.</div>
            <div className="typewriter rounded-2xl bg-white px-4 py-3 shadow-sm [animation-delay:0.35s]">Methodology: revenue aggregation minus operating cost layers.</div>
            <div className="typewriter rounded-2xl bg-white px-4 py-3 shadow-sm [animation-delay:0.7s]">Formula blueprint: rebuild path, dependencies, and rewrite opportunities.</div>
          </div>
        </div>
        <div className="rounded-[30px] border border-border-subtle bg-white p-5">
          <div className="eyebrow">Business summary</div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-text-secondary">
            <div className="rounded-2xl bg-bg-elevated px-4 py-3">This metric shows how topline contribution converts into operating profit.</div>
            <div className="rounded-2xl bg-bg-elevated px-4 py-3">It is driven by revenue totals, cost structure, and operating expense assumptions.</div>
            <div className="rounded-2xl bg-bg-elevated px-4 py-3">Any change in underlying regional inputs directly changes the output narrative.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StageChat() {
  return (
    <div className="stage-enter relative h-[430px] overflow-hidden rounded-[36px] border border-border-subtle bg-white/90 p-5 shadow-[0_24px_80px_rgba(28,27,25,0.08)]">
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">Workbook chat</div>
          <div className="mt-2 text-lg font-semibold tracking-tight">Ask questions, create charts, and apply workbook edits</div>
        </div>
        <div className="rounded-full bg-bg-tint px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-accent">Stage 5</div>
      </div>
      <div className="mt-8 grid gap-4 xl:grid-cols-[1fr_240px]">
        <div className="space-y-3">
          <div className="rounded-[24px] border border-border-subtle bg-white px-4 py-3 shadow-sm">
            <div className="text-xs uppercase tracking-[0.18em] text-text-tertiary">You</div>
            <div className="mt-2 text-sm">Build a chart showing quarterly revenue and insert it near the summary block.</div>
          </div>
          <div className="rounded-[24px] border border-violet/15 bg-violet/5 px-4 py-3 shadow-sm">
            <div className="text-xs uppercase tracking-[0.18em] text-violet">CalcSense</div>
            <div className="mt-2 text-sm leading-6 text-text-secondary">
              I found the revenue rows, built a quarterly bar chart, and prepared the insert action for the current sheet.
            </div>
          </div>
        </div>
        <div className="rounded-[24px] border border-border-subtle bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Chart preview</div>
          <div className="mt-4 flex items-end gap-3">
            {[62, 71, 78, 84].map((height, index) => (
              <div key={height} className="flex flex-1 flex-col items-center gap-2">
                <div className="chart-bar-grow w-full rounded-t-xl bg-[linear-gradient(180deg,#0F766E,#2563EB)]" style={{ height: `${height}px`, animationDelay: `${index * 120}ms` }} />
                <div className="text-[11px] uppercase tracking-[0.12em] text-text-tertiary">Q{index + 1}</div>
              </div>
            ))}
          </div>
          <div className="animate-slide-up mt-4 rounded-full bg-accent px-3 py-2 text-center text-[11px] uppercase tracking-[0.18em] text-white shadow-lg">
            Chart inserted
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroDemo() {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setStageIndex((current) => (current + 1) % STAGES.length);
    }, STAGES[stageIndex].duration);
    return () => window.clearTimeout(timeout);
  }, [stageIndex]);

  const active = STAGES[stageIndex];

  return (
    <div className="relative overflow-hidden rounded-[42px] border border-white/70 bg-white/95 p-4 shadow-[0_32px_90px_rgba(34,32,28,0.08)] lg:p-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-aurora-1 absolute -left-24 top-4 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />
        <div className="animate-aurora-2 absolute bottom-8 right-0 h-64 w-64 rounded-full bg-violet/10 blur-3xl" />
      </div>
      <div className="relative mb-5 flex items-center justify-between">
        <AIBadge />
        <div className="rounded-full border border-border-subtle bg-white/80 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-text-secondary">
          Auto demo
        </div>
      </div>
      <div className="mb-4 flex items-center gap-2">
        {STAGES.map((stage, index) => (
          <div key={stage.key} className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${stageIndex === index ? "bg-accent text-white" : "bg-bg-elevated text-text-secondary"}`}>
            {stage.label}
          </div>
        ))}
      </div>
      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-bg-elevated">
        <div className="stage-progress-bar h-full rounded-full bg-[linear-gradient(90deg,#0F766E,#2563EB,#7C3AED)]" key={active.key} style={{ ["--stage-duration" as never]: `${active.duration}ms` }} />
      </div>
      {active.key === "drop" ? <StageDrop /> : null}
      {active.key === "scan" ? <StageScan /> : null}
      {active.key === "trace" ? <StageTree /> : null}
      {active.key === "explain" ? <StageExplain /> : null}
      {active.key === "chat" ? <StageChat /> : null}
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [recentFiles, setRecentFiles] = useState<FileEntry[]>([]);
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [progress, setProgress] = useState("Drop an .xlsx workbook here or click upload to begin.");
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    void fetchRegistry().then(setRecentFiles).catch(() => undefined);
    let active = true;
    const poll = async () => {
      try {
        const status = await fetchBackendStatus();
        if (active) setBackendStatus(status);
        if (status.ready || !active) return;
      } catch {
        if (!active) return;
      }
      window.setTimeout(() => void poll(), 1500);
    };
    void poll();
    return () => {
      active = false;
    };
  }, []);

  async function handleFile(file: File) {
    setError(null);
    await uploadFile(file, {
      onProgress: (message) => setProgress(message),
      onDone: (payload) => router.push(`/workbook/${payload.file_id}`),
    }).catch((err) => setError(err instanceof Error ? err.message : "Upload failed"));
  }

  const capabilityStrip = useMemo(
    () => [
      "Trace dependencies",
      "Explain formulas",
      "Generate blueprints",
      "Ask workbook questions",
      "Insert charts",
      "Edit cells in place",
    ],
    [],
  );

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
        <section className="grid items-start gap-12 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="pt-4">
            <div className="inline-flex rounded-full border border-border-subtle bg-white/90 px-4 py-2 text-sm text-text-secondary shadow-sm">
              Built for workbook reviews, audit trails, model handoffs, and finance narratives
            </div>
            <div className="mt-7 flex items-center gap-3">
              <span className="rounded-full bg-accent px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-white">Step 1</span>
              <span className="text-[11px] uppercase tracking-[0.24em] text-text-tertiary">Upload, trace, explain, optimize</span>
            </div>
            <h1 className="headline-highlight mt-5 max-w-3xl font-serif-display text-6xl leading-none tracking-tight lg:text-7xl">
              See what&apos;s behind every number in your model
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-text-secondary">
              Upload an Excel workbook to trace formulas down to their source values, visualize dependency chains, generate analyst-grade explanations, and make workbook-safe edits without leaving the browser.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <button className="rounded-2xl bg-accent px-6 py-4 text-white shadow-[0_14px_30px_rgba(15,118,110,0.22)] transition hover:-translate-y-0.5 hover:bg-accent-dim disabled:cursor-not-allowed disabled:opacity-60" onClick={() => inputRef.current?.click()} disabled={backendStatus ? !backendStatus.ready : false}>
                Upload Workbook
              </button>
              <div className="min-w-[280px] rounded-2xl border border-border-subtle bg-white/90 px-5 py-4 text-sm text-text-secondary shadow-sm">{progress}</div>
            </div>
            {backendStatus && !backendStatus.ready ? (
              <div className="mt-4 rounded-2xl border border-border-subtle bg-white/80 px-4 py-3 text-sm text-text-secondary">
                {backendStatus.detail} ({backendStatus.files_loaded}/{backendStatus.files_total})
              </div>
            ) : null}
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
          <HeroDemo />
        </section>

        <section className="mt-12 overflow-hidden rounded-[30px] border border-border-subtle bg-white/80 py-4 shadow-sm">
          <div className="ticker-track flex gap-3 whitespace-nowrap px-6">
            {[...capabilityStrip, ...capabilityStrip].map((item, index) => (
              <div key={`${item}-${index}`} className="rounded-full border border-border-subtle bg-bg-elevated px-4 py-2 text-sm text-text-secondary">
                {item}
              </div>
            ))}
          </div>
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
            {recentFiles.map((file, index) => (
              <div key={file.file_id} className="animate-fade-in-up hover-lift rounded-[30px] border border-border-subtle bg-white/90 p-5 shadow-sm" style={{ animationDelay: `${index * 60}ms` }}>
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

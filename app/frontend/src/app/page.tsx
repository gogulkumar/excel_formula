"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { AppHeader } from "@/components/header";
import { deleteFileEntry, fetchBackendStatus, fetchRegistry, uploadFile } from "@/lib/api";
import type { BackendStatus, FileEntry } from "@/lib/types";

const HERO_MESSAGES = [
  {
    eyebrow: "Your entire model depends on this",
    titleTop: "How many formulas",
    titleBottom: "can you explain?",
    body:
      "CalcSense traces every formula, every hidden connection, and every dependency chain so finance teams can audit, explain, and edit workbook logic without opening Excel.",
  },
  {
    eyebrow: "The workbook works",
    titleTop: "Nobody knows",
    titleBottom: "why.",
    body:
      "Inherited models keep running long after the original builder leaves. CalcSense reconstructs the logic path so teams can understand what the workbook is actually doing.",
  },
  {
    eyebrow: "The number changed",
    titleTop: "Nobody knows",
    titleBottom: "where.",
    body:
      "When a result moves, teams need the exact formula path and sheet-to-sheet dependencies behind it. CalcSense traces the shift back to the source.",
  },
  {
    eyebrow: "Close is tomorrow",
    titleTop: "The model is still",
    titleBottom: "fragile.",
    body:
      "Month-end and forecast models break under time pressure. CalcSense surfaces the formulas, assumptions, and handoffs that matter before close gets blocked.",
  },
  {
    eyebrow: "A formula broke",
    titleTop: "The owner already",
    titleBottom: "left.",
    body:
      "Business-critical spreadsheets often outlive the analyst who built them. CalcSense gives the next team an interpretable map instead of a black box.",
  },
  {
    eyebrow: "Tabs keep growing",
    titleTop: "Auditability keeps",
    titleBottom: "shrinking.",
    body:
      "Large workbooks sprawl across tabs, helper blocks, and hidden dependencies. CalcSense condenses that sprawl into something teams can inspect and explain quickly.",
  },
  {
    eyebrow: "You trust the output",
    titleTop: "You can’t trace",
    titleBottom: "the path.",
    body:
      "Results may look right while the supporting logic stays opaque. CalcSense follows the chain from output cell to base input so users can verify the reasoning.",
  },
  {
    eyebrow: "The board wants answers",
    titleTop: "The model gives",
    titleBottom: "cell refs.",
    body:
      "Executives need clear business narratives, not spreadsheet shorthand. CalcSense translates workbook mechanics into technical explanations and executive summaries.",
  },
  {
    eyebrow: "You need the logic",
    titleTop: "Not another",
    titleBottom: "screenshot.",
    body:
      "Static screenshots never explain formulas, dependencies, or context. CalcSense keeps the workbook live, searchable, and editable while it explains the logic.",
  },
  {
    eyebrow: "The assumption moved",
    titleTop: "Everything downstream",
    titleBottom: "shifted.",
    body:
      "One changed driver can ripple across forecasts, bridges, and summaries. CalcSense shows the downstream impact chain before teams publish the wrong answer.",
  },
  {
    eyebrow: "Finance needs speed",
    titleTop: "Manual tracing",
    titleBottom: "kills it.",
    body:
      "Analysts should not spend hours following formulas by hand. CalcSense compresses workbook analysis into a faster workflow for tracing, explaining, and editing.",
  },
] as const;

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
      <div className="relative mt-8 flex flex-col overflow-hidden rounded-xl border border-[#d4d4d4] bg-white shadow-sm font-sans">
        <div className="scan-sweep absolute inset-y-0 left-0 z-20 w-24 bg-[linear-gradient(90deg,transparent,rgba(15,118,110,0.18),transparent)] pointer-events-none" />
        
        {/* Fake Formula Bar */}
        <div className="flex items-center gap-2 border-b border-[#d4d4d4] bg-[#f9f9f9] px-2 py-1.5 text-xs text-text-secondary">
          <div className="flex items-center justify-center rounded bg-white px-2 py-0.5 border border-[#d4d4d4] font-medium w-12 shadow-sm">
            E4
          </div>
          <div className="text-[#a0a0a0]">|</div>
          <div className="flex items-center text-accent/70 italic mr-1">fx</div>
          <div className="flex-1 rounded bg-white px-2 py-0.5 border border-[#d4d4d4] font-mono-ui text-sm shadow-sm">
            =SUM(B4:D4)
          </div>
        </div>

        {/* Excel Grid container */}
        <div className="flex bg-[#f3f2f1] text-[11px] text-[#605e5c]">
          {/* Top-left corner */}
          <div className="w-8 border-b border-r border-[#d4d4d4] shrink-0" />
          
          {/* Column Headers */}
          <div className="flex flex-1">
            {["A", "B", "C", "D", "E"].map((col) => (
              <div key={col} className={`flex-1 border-b border-r border-[#d4d4d4] py-1 text-center font-medium ${col === "E" ? "bg-[#e1dfdd]" : ""}`}>
                {col}
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        <div className="flex flex-col bg-white">
          {[
            ["Metric", "Q1", "Q2", "Q3", "FY"],
            ["Revenue", "120", "130", "140", "=SUM(B2:D2)"],
            ["COGS", "40", "43", "45", "=SUM(B3:D3)"],
            ["Gross Profit", "=B2-B3", "=C2-C3", "=D2-D3", "=SUM(B4:D4)"],
            ["OpEx", "18", "19", "20", "=SUM(B5:D5)"],
            ["EBITDA", "=B4-B5", "=C4-C5", "=D4-D5", "=SUM(B6:D6)"],
          ].map((row, rowIndex) => (
            <div key={rowIndex} className="flex">
              {/* Row Number */}
              <div className={`w-8 shrink-0 border-b border-r border-[#d4d4d4] bg-[#f3f2f1] py-1.5 text-center text-[11px] text-[#605e5c] font-medium ${rowIndex === 3 ? "bg-[#e1dfdd]" : ""}`}>
                {rowIndex + 1}
              </div>
              
              {/* Cells */}
              <div className="flex flex-1">
                {row.map((value, colIndex) => {
                  const isHeader = rowIndex === 0;
                  const isFormula = colIndex === 4 || rowIndex >= 3;
                  const isSelected = rowIndex === 3 && colIndex === 4;
                  
                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={`relative flex-1 border-b border-r border-[#e1dfdd] px-2 py-1.5 text-xs truncate ${
                        isHeader ? "font-semibold bg-white" : 
                        isFormula ? "font-mono-ui text-[#0a5e56]" : "bg-white"
                      } ${isSelected ? "ring-2 ring-inset ring-[#107c41] bg-[#f2fcf6] z-10" : ""}`}
                    >
                      {value}
                      {/* Active cell outline handle */}
                      {isSelected && <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-[#107c41] border border-white" />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Summary stats */}
        <div className="bg-[#fbfaf7] border-t border-[#d4d4d4] p-3 text-[11px] text-[#605e5c] flex justify-between items-center font-medium">
          <div className="flex gap-4">
            <span>8 Sheets loaded</span>
            <span>214 Formulas indexed</span>
            <span>6 Tables found</span>
          </div>
          <div className="text-accent/70 uppercase tracking-widest text-[9px]">Ready</div>
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

interface DiscoveredFile {
  name: string;
  path: string;
  size: number;
  lastModified: number;
  handle: any;
}

async function scanDirectoryForExcel(dirHandle: any, basePath = ""): Promise<DiscoveredFile[]> {
  const results: DiscoveredFile[] = [];
  for await (const entry of dirHandle.values()) {
    const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;
    if (entry.kind === "file" && entry.name.toLowerCase().endsWith(".xlsx") && !entry.name.startsWith("~$")) {
      try {
        const file = await entry.getFile();
        results.push({ name: entry.name, path: entryPath, size: file.size, lastModified: file.lastModified, handle: entry });
      } catch { /* skip inaccessible files */ }
    } else if (entry.kind === "directory" && !entry.name.startsWith(".") && entry.name !== "node_modules") {
      try {
        results.push(...await scanDirectoryForExcel(entry, entryPath));
      } catch { /* skip inaccessible directories */ }
    }
  }
  return results.sort((a, b) => b.lastModified - a.lastModified);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function HomePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [recentFiles, setRecentFiles] = useState<FileEntry[]>([]);
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [progress, setProgress] = useState("Drop an .xlsx workbook here or click upload to begin.");
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [discoveredFiles, setDiscoveredFiles] = useState<DiscoveredFile[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [scanFolderName, setScanFolderName] = useState("");
  const [supportsDirectoryBrowse, setSupportsDirectoryBrowse] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [recentQuery, setRecentQuery] = useState("");
  const [showAllRecentFiles, setShowAllRecentFiles] = useState(false);

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

  useEffect(() => {
    setSupportsDirectoryBrowse("showDirectoryPicker" in window);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setHeroIndex((current) => (current + 1) % HERO_MESSAGES.length);
    }, 3200);
    return () => window.clearInterval(interval);
  }, []);

  async function handleFile(file: File) {
    setError(null);
    setShowFileBrowser(false);
    await uploadFile(file, {
      onProgress: (message) => setProgress(message),
      onDone: (payload) => router.push(`/workbook/${payload.file_id}`),
    }).catch((err) => setError(err instanceof Error ? err.message : "Upload failed"));
  }

  async function handleBrowseFolder() {
    // Check browser support for File System Access API
    if (!("showDirectoryPicker" in window)) {
      // Fallback: just open regular file picker
      inputRef.current?.click();
      return;
    }
    try {
      const dirHandle = await (window as any).showDirectoryPicker({ mode: "read" });
      setScanFolderName(dirHandle.name);
      setShowFileBrowser(true);
      setIsScanning(true);
      setDiscoveredFiles([]);
      const files = await scanDirectoryForExcel(dirHandle);
      setDiscoveredFiles(files);
      setIsScanning(false);
      if (files.length === 0) {
        setError("No .xlsx files found in the selected folder.");
        setShowFileBrowser(false);
      }
    } catch (err: any) {
      // User cancelled the picker
      if (err?.name !== "AbortError") {
        setError("Could not access that folder. Try a different one.");
      }
      setIsScanning(false);
    }
  }

  async function handlePickDiscoveredFile(discovered: DiscoveredFile) {
    try {
      const file = await discovered.handle.getFile();
      await handleFile(file);
    } catch {
      setError("Could not read that file. It may have been moved or deleted.");
    }
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

  const activeHero = HERO_MESSAGES[heroIndex];
  const filteredRecentFiles = useMemo(() => {
    const query = recentQuery.trim().toLowerCase();
    if (!query) return recentFiles;
    return recentFiles.filter((file) => {
      if (file.filename.toLowerCase().includes(query)) return true;
      return file.sheets.some((sheet) => sheet.toLowerCase().includes(query));
    });
  }, [recentFiles, recentQuery]);

  return (
    <main
      className="h-screen overflow-hidden bg-bg-deep"
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
      <div className="mx-auto flex h-[calc(100vh-73px)] max-w-7xl flex-col px-6 py-5">
        <section className="grid min-h-0 flex-1 items-stretch gap-6 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="flex h-full min-h-0 flex-col overflow-hidden pt-2">
            <div className="min-h-[230px] lg:min-h-[250px] xl:min-h-[270px]">
              <div className="text-[11px] uppercase tracking-[0.26em] text-text-tertiary">{activeHero.eyebrow}</div>
              <h1
                key={`hero-${heroIndex}`}
                className="mt-4 max-w-3xl animate-fade-in-up text-5xl font-semibold leading-[0.92] tracking-[-0.05em] xl:text-6xl"
              >
                {activeHero.titleTop}
                <br />
                <span className="text-accent">{activeHero.titleBottom}</span>
              </h1>
              <p
                key={`hero-body-${heroIndex}`}
                className="mt-4 max-w-2xl animate-fade-in text-[15px] leading-6 text-text-secondary"
              >
                {activeHero.body}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button className="rounded-2xl bg-accent px-6 py-4 text-white shadow-[0_14px_30px_rgba(15,118,110,0.22)] transition hover:-translate-y-0.5 hover:bg-accent-dim disabled:cursor-not-allowed disabled:opacity-60" onClick={() => inputRef.current?.click()} disabled={backendStatus ? !backendStatus.ready : false}>
                Open Workbook
              </button>
              <div className="min-w-[260px] flex-1 rounded-2xl border border-border-subtle bg-white/90 px-4 py-3 text-sm text-text-secondary shadow-sm lg:min-w-[220px]">{progress}</div>
            </div>
            {supportsDirectoryBrowse ? (
              <button
                className="mt-3 text-sm text-accent transition hover:text-accent-dim disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleBrowseFolder}
                disabled={backendStatus ? !backendStatus.ready : false}
              >
                Or scan a folder for Excel workbooks
              </button>
            ) : null}
            {backendStatus && !backendStatus.ready ? (
              <div className="mt-3 rounded-2xl border border-border-subtle bg-white/80 px-4 py-3 text-sm text-text-secondary">
                {backendStatus.detail} ({backendStatus.files_loaded}/{backendStatus.files_total})
              </div>
            ) : null}
            {error ? <div className="mt-3 rounded-2xl border border-rose bg-rose/5 px-4 py-3 text-sm text-rose">{error}</div> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {capabilityStrip.map((item) => (
                <div key={item} className="rounded-full border border-[#e9e6e1] bg-white px-3 py-1.5 text-xs text-text-secondary">
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-4 min-h-0 flex-1">
              <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] border border-border-subtle bg-white/90 p-3 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-text-tertiary">Workspace</div>
                    <h2 className="mt-1 text-base font-medium tracking-tight">Recent files</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {recentFiles.length > 6 ? (
                      <button
                        className="rounded-full border border-border-subtle bg-white px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-text-secondary transition hover:border-accent hover:text-accent"
                        onClick={() => setShowAllRecentFiles(true)}
                      >
                        View all
                      </button>
                    ) : null}
                    <div className="rounded-full border border-border-subtle bg-bg-deep px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-text-secondary">
                      {recentFiles.length} workbook{recentFiles.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
                {recentFiles.length > 0 ? (
                  <div className="mt-2 min-h-0 flex-1 overflow-x-auto overflow-y-hidden pb-1">
                    <div className="flex min-w-full items-stretch gap-2.5 pr-1 [scroll-snap-type:x_mandatory]">
                    {filteredRecentFiles.map((file, index) => (
                      <div
                        key={file.file_id}
                        className="animate-fade-in-up flex h-[94px] w-[430px] min-w-[430px] flex-none items-stretch gap-2.5 rounded-[16px] border border-border-subtle bg-bg-deep px-3 py-2.5 [scroll-snap-align:start]"
                        style={{ animationDelay: `${index * 60}ms` }}
                      >
                        <button className="min-w-0 flex-1 text-left" onClick={() => router.push(`/workbook/${file.file_id}`)}>
                          <div className="flex h-full flex-col justify-between">
                            <div>
                              <div className="overflow-x-auto whitespace-nowrap text-[14px] font-medium tracking-tight [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                {file.filename}
                              </div>
                              <div className="mt-0.5 text-sm text-text-secondary">{file.sheets.length} sheets ready for analysis</div>
                            </div>
                            <div className="mt-2 flex flex-nowrap gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                              {file.sheets.slice(0, 3).map((sheet) => (
                                <span key={sheet} className="whitespace-nowrap rounded-full border border-border-subtle bg-white px-2 py-0.5 text-[11px] text-text-secondary">
                                  {sheet}
                                </span>
                              ))}
                            </div>
                          </div>
                        </button>
                        <div className="flex w-[88px] flex-none flex-col items-end justify-between">
                          <button
                            className="rounded-full bg-bg-tint px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-accent transition hover:bg-accent hover:text-white"
                            onClick={() => router.push(`/workbook/${file.file_id}`)}
                          >
                            Open
                          </button>
                          <button
                            className="rounded-full border border-border-subtle px-3 py-0.5 text-[12px] text-text-secondary transition hover:border-rose hover:text-rose"
                            onClick={async () => {
                              await deleteFileEntry(file.file_id);
                              setRecentFiles((current) => current.filter((item) => item.file_id !== file.file_id));
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-[18px] border border-dashed border-border-subtle bg-bg-deep px-4 py-4 text-sm text-text-secondary">
                    Upload a workbook to start building a searchable analysis workspace.
                  </div>
                )}
              </div>
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
          <div className="h-full min-h-0">
            <HeroDemo />
          </div>
        </section>

        {/* ── File Browser Modal ── */}
        {showFileBrowser ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowFileBrowser(false)}>
            <div className="mx-4 w-full max-w-xl animate-fade-in-up rounded-[30px] border border-border-subtle bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-text-tertiary">File Browser</div>
                  <h3 className="mt-1 text-lg font-semibold tracking-tight">Excel files in <span className="text-accent">{scanFolderName}</span></h3>
                </div>
                <button onClick={() => setShowFileBrowser(false)} className="rounded-full border border-border-subtle p-2 text-text-secondary transition hover:border-accent hover:text-accent">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>

              {isScanning ? (
                <div className="mt-8 flex flex-col items-center gap-4 py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/20 border-t-accent" />
                  <div className="text-sm text-text-secondary">Scanning for .xlsx files…</div>
                </div>
              ) : (
                <div className="mt-5 max-h-[400px] space-y-2 overflow-y-auto">
                  {discoveredFiles.map((file, idx) => (
                    <button
                      key={`${file.path}-${idx}`}
                      onClick={() => void handlePickDiscoveredFile(file)}
                      className="group flex w-full items-center gap-4 rounded-2xl border border-border-subtle bg-bg-deep p-4 text-left transition hover:border-accent/40 hover:bg-accent/5 hover:shadow-sm"
                    >
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium tracking-tight">{file.name}</div>
                        <div className="mt-0.5 truncate text-xs text-text-tertiary">{file.path}</div>
                      </div>
                      <div className="flex flex-shrink-0 flex-col items-end gap-1">
                        <div className="text-xs text-text-secondary">{formatFileSize(file.size)}</div>
                        <div className="text-[10px] text-text-tertiary">{new Date(file.lastModified).toLocaleDateString()}</div>
                      </div>
                      <div className="rounded-full bg-accent px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white opacity-0 transition group-hover:opacity-100">
                        Open
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-5 flex items-center justify-between">
                <div className="text-xs text-text-tertiary">
                  {isScanning ? "Searching…" : `${discoveredFiles.length} file${discoveredFiles.length === 1 ? "" : "s"} found`}
                </div>
                <button onClick={handleBrowseFolder} className="rounded-full border border-border-subtle px-4 py-2 text-sm text-text-secondary transition hover:border-accent hover:text-accent">
                  Scan different folder
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showAllRecentFiles ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowAllRecentFiles(false)}>
            <div className="mx-4 flex max-h-[78vh] w-full max-w-4xl flex-col overflow-hidden rounded-[30px] border border-border-subtle bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-text-tertiary">Workspace</div>
                  <h3 className="mt-1 text-lg font-semibold tracking-tight">Recent files</h3>
                </div>
                <button
                  onClick={() => setShowAllRecentFiles(false)}
                  className="rounded-full border border-border-subtle p-2 text-text-secondary transition hover:border-accent hover:text-accent"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <input
                  value={recentQuery}
                  onChange={(e) => setRecentQuery(e.target.value)}
                  placeholder="Search files or sheets"
                  className="w-full rounded-2xl border border-border-subtle bg-bg-deep px-4 py-3 text-sm outline-none transition focus:border-accent"
                />
                <div className="rounded-full border border-border-subtle bg-bg-deep px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-text-secondary">
                  {filteredRecentFiles.length} result{filteredRecentFiles.length === 1 ? "" : "s"}
                </div>
              </div>
              <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="space-y-2">
                  {filteredRecentFiles.map((file, index) => (
                    <div
                      key={file.file_id}
                      className="animate-fade-in-up flex items-center gap-4 rounded-[20px] border border-border-subtle bg-bg-deep px-4 py-3"
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      <button className="min-w-0 flex-1 text-left" onClick={() => router.push(`/workbook/${file.file_id}`)}>
                        <div className="truncate text-[15px] font-medium tracking-tight">{file.filename}</div>
                        <div className="mt-1 text-sm text-text-secondary">{file.sheets.length} sheets ready for analysis</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {file.sheets.slice(0, 5).map((sheet) => (
                            <span key={sheet} className="rounded-full border border-border-subtle bg-white px-2.5 py-1 text-xs text-text-secondary">
                              {sheet}
                            </span>
                          ))}
                        </div>
                      </button>
                      <div className="flex flex-none items-center gap-2">
                        <button
                          className="rounded-full bg-bg-tint px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-accent transition hover:bg-accent hover:text-white"
                          onClick={() => router.push(`/workbook/${file.file_id}`)}
                        >
                          Open
                        </button>
                        <button
                          className="rounded-full border border-border-subtle px-3 py-1.5 text-sm text-text-secondary transition hover:border-rose hover:text-rose"
                          onClick={async () => {
                            await deleteFileEntry(file.file_id);
                            setRecentFiles((current) => current.filter((item) => item.file_id !== file.file_id));
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                  {filteredRecentFiles.length === 0 ? (
                    <div className="rounded-[18px] border border-dashed border-border-subtle bg-bg-deep px-4 py-6 text-sm text-text-secondary">
                      No recent files matched your search.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

      </div>
    </main>
  );
}

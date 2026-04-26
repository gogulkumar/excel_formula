"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { AppHeader } from "@/components/header";
import { SummarySheet } from "@/components/summary-sheet";
import { fetchFile } from "@/lib/api";
import type { FileEntry } from "@/lib/types";

type SheetCategory = "Overview" | "Financials" | "Forecast" | "Actuals" | "Models" | "Inputs" | "Other";

const CATEGORY_ORDER: SheetCategory[] = ["Overview", "Financials", "Forecast", "Actuals", "Models", "Inputs", "Other"];

function categorizeSheet(sheet: string): SheetCategory {
  const lowered = sheet.toLowerCase();
  if (/(overview|instruction|summary|cover|toc|index)/.test(lowered)) return "Overview";
  if (/(p&l|balsht|balance|cash flow|cashflow| cf\b|capex|tax|interest)/.test(lowered)) return "Financials";
  if (/(forecast|fcst|fcf|outlook)/.test(lowered)) return "Forecast";
  if (/(actual|ytd|q[1-4]|fy|month|quarter|walks)/.test(lowered)) return "Actuals";
  if (/(model|calc|chart|waterfall|seasonality|roic|ros)/.test(lowered)) return "Models";
  if (/(input|driver|assumption|data)/.test(lowered)) return "Inputs";
  return "Other";
}

const CATEGORY_TONE: Record<SheetCategory, string> = {
  Overview: "bg-accent/12 text-accent border-accent/20",
  Financials: "bg-accent/10 text-accent border-accent/15",
  Forecast: "bg-violet/10 text-violet border-violet/15",
  Actuals: "bg-teal/10 text-teal border-teal/15",
  Models: "bg-bg-elevated text-text-secondary border-border-subtle",
  Inputs: "bg-blue/10 text-blue border-blue/15",
  Other: "bg-bg-elevated text-text-secondary border-border-subtle",
};

export default function WorkbookPage() {
  const params = useParams<{ fileId: string }>();
  const router = useRouter();
  const [file, setFile] = useState<FileEntry | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filterRef = useRef<HTMLInputElement | null>(null);
  const cardsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void fetchFile(params.fileId)
      .then((value) => setFile(value))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load workbook"))
      .finally(() => setLoading(false));
  }, [params.fileId]);

  function handleFilter() {
    const needle = filterRef.current?.value.toLowerCase() || "";
    const buttons = cardsRef.current?.querySelectorAll<HTMLButtonElement>("[data-sheet-name]");
    buttons?.forEach((button) => {
      const match = (button.dataset.sheetName || "").toLowerCase().includes(needle);
      button.style.display = match ? "" : "none";
    });
  }

  const groupedSheets = useMemo(() => {
    const grouped = new Map<SheetCategory, string[]>();
    for (const category of CATEGORY_ORDER) grouped.set(category, []);
    for (const sheet of file?.sheets || []) {
      grouped.get(categorizeSheet(sheet))?.push(sheet);
    }
    return grouped;
  }, [file]);

  if (loading) {
    return (
      <main className="min-h-screen bg-bg-deep">
        <AppHeader step={2} fileId={params.fileId} />
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="animate-shimmer h-14 rounded-3xl" />
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="animate-shimmer h-36 rounded-[28px]" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (!file) {
    return (
      <main className="min-h-screen bg-bg-deep">
        <AppHeader step={2} fileId={params.fileId} />
        <div className="mx-auto max-w-4xl px-6 py-16">
          <div className="rounded-[30px] border border-rose/20 bg-white p-8 shadow-sm">
            <div className="text-xs uppercase tracking-[0.24em] text-rose">Workbook error</div>
            <div className="mt-3 text-2xl font-medium tracking-tight">We couldn&apos;t load this workbook.</div>
            <div className="mt-3 text-sm text-text-secondary">{error || "Please return to the upload page and try again."}</div>
            <button onClick={() => router.push("/")} className="mt-6 rounded-2xl bg-accent px-5 py-3 text-white">Back to upload</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg-deep">
      <AppHeader step={2} filename={file.filename} fileId={params.fileId} backHref="/" />
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-text-tertiary">Step 2 of 3 · Choose a sheet</div>
            <h1 className="mt-2 text-3xl font-medium tracking-tight">Select the area you want to analyze</h1>
            <p className="mt-2 text-text-secondary">Sheets are grouped by workbook role so you can get to the right model layer faster.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <input ref={filterRef} onInput={handleFilter} placeholder="Search sheets" className="rounded-2xl border border-border-subtle bg-white px-4 py-3 shadow-sm" />
            <button className="rounded-2xl bg-accent px-5 py-3 text-white shadow-sm" onClick={() => setShowSummary((current) => !current)}>
              Summary Sheet
            </button>
          </div>
        </div>

        {showSummary ? (
          <div className="mt-8">
            <SummarySheet fileId={params.fileId} file={file} />
          </div>
        ) : null}

        <div ref={cardsRef} className="mt-10 space-y-8">
          {CATEGORY_ORDER.map((category) => {
            const sheets = groupedSheets.get(category) || [];
            if (!sheets.length) return null;
            return (
              <section key={category}>
                <div className="mb-4 flex items-center gap-3">
                  <div className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${CATEGORY_TONE[category]}`}>
                    {category}
                  </div>
                  <div className="text-sm text-text-secondary">{sheets.length} sheet{sheets.length === 1 ? "" : "s"}</div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {sheets.map((sheet, index) => (
                    <button
                      key={sheet}
                      data-sheet-name={sheet}
                      onClick={() => router.push(`/workbook/${params.fileId}/${encodeURIComponent(sheet)}`)}
                      className="animate-fade-in-up group rounded-[28px] border border-border-subtle bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(0,0,0,0.06)]"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className={`mb-4 h-1.5 w-16 rounded-full ${CATEGORY_TONE[category].includes("accent") ? "bg-accent" : CATEGORY_TONE[category].includes("violet") ? "bg-violet" : CATEGORY_TONE[category].includes("teal") ? "bg-teal" : CATEGORY_TONE[category].includes("blue") ? "bg-blue" : "bg-border-medium"}`} />
                      <div className="font-medium tracking-tight">{sheet}</div>
                      <div className="mt-2 text-sm text-text-secondary">Open this sheet to inspect formulas, tables, and workbook logic.</div>
                      <div className="mt-4 text-[11px] uppercase tracking-[0.18em] text-accent opacity-0 transition group-hover:opacity-100">Open sheet</div>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}

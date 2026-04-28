"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { AppHeader } from "@/components/header";
import { SummarySheet } from "@/components/summary-sheet";
import { fetchFile } from "@/lib/api";
import type { FileEntry } from "@/lib/types";

type SheetCategory = "Overview" | "Financials" | "Forecast" | "Actuals" | "Models" | "Inputs" | "Other";

const CATEGORY_ORDER: SheetCategory[] = ["Overview", "Financials", "Forecast", "Actuals", "Models", "Inputs", "Other"];

const CATEGORY_META: Record<SheetCategory, { label: string; desc: string; accent: string; bar: string }> = {
  Overview:   { label: "Overview",   desc: "Summary & index sheets",      accent: "bg-accent/10 text-accent border-accent/20",     bar: "bg-accent" },
  Financials: { label: "Financials", desc: "P&L, balance sheet, cash",    accent: "bg-accent/8 text-accent border-accent/15",      bar: "bg-accent/80" },
  Forecast:   { label: "Forecast",   desc: "Forward projections",         accent: "bg-violet/10 text-violet border-violet/20",     bar: "bg-violet" },
  Actuals:    { label: "Actuals",    desc: "Historical data & YTD",       accent: "bg-teal/10 text-teal border-teal/20",           bar: "bg-teal" },
  Models:     { label: "Models",     desc: "Calculations & charts",       accent: "bg-bg-elevated text-text-secondary border-border-subtle", bar: "bg-border-medium" },
  Inputs:     { label: "Inputs",     desc: "Assumptions & drivers",       accent: "bg-blue/10 text-blue border-blue/20",           bar: "bg-blue" },
  Other:      { label: "Other",      desc: "Uncategorised sheets",        accent: "bg-bg-elevated text-text-secondary border-border-subtle", bar: "bg-border-medium" },
};

function categorizeSheet(sheet: string): SheetCategory {
  const s = sheet.toLowerCase();
  if (/(overview|instruction|summary|cover|toc|index)/.test(s)) return "Overview";
  if (/(p&l|balsht|balance|cash flow|cashflow|\bcf\b|capex|tax|interest)/.test(s)) return "Financials";
  if (/(forecast|fcst|fcf|outlook)/.test(s)) return "Forecast";
  if (/(actual|ytd|q[1-4]|fy|month|quarter|walks)/.test(s)) return "Actuals";
  if (/(model|calc|chart|waterfall|seasonality|roic|ros)/.test(s)) return "Models";
  if (/(input|driver|assumption|data)/.test(s)) return "Inputs";
  return "Other";
}

function SheetIcon({ category }: { category: SheetCategory }) {
  const icons: Record<SheetCategory, string> = {
    Overview: "◈", Financials: "₿", Forecast: "▲", Actuals: "◎", Models: "⬡", Inputs: "◇", Other: "□",
  };
  return <span className="text-[15px]">{icons[category]}</span>;
}

export default function WorkbookPage() {
  const params = useParams<{ fileId: string }>();
  const router = useRouter();
  const [file, setFile] = useState<FileEntry | null>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "sheets">("sheets");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filterRef = useRef<HTMLInputElement | null>(null);
  const cardsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void fetchFile(params.fileId)
      .then(setFile)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load workbook"))
      .finally(() => setLoading(false));
  }, [params.fileId]);

  function handleFilter() {
    const needle = filterRef.current?.value.toLowerCase() || "";
    const buttons = cardsRef.current?.querySelectorAll<HTMLButtonElement>("[data-sheet-name]");
    buttons?.forEach((btn) => {
      btn.style.display = (btn.dataset.sheetName || "").toLowerCase().includes(needle) ? "" : "none";
    });
  }

  const groupedSheets = useMemo(() => {
    const grouped = new Map<SheetCategory, string[]>();
    for (const cat of CATEGORY_ORDER) grouped.set(cat, []);
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
          <div className="animate-shimmer h-24 rounded-[28px]" />
          <div className="mt-6 animate-shimmer h-10 w-64 rounded-2xl" />
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-shimmer h-36 rounded-[24px]" />
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
            <div className="text-xs uppercase tracking-[0.24em] text-rose">Error</div>
            <div className="mt-3 text-2xl font-medium tracking-tight">Could not load this workbook.</div>
            <div className="mt-3 text-sm text-text-secondary">{error || "Return to the upload page and try again."}</div>
            <button onClick={() => router.push("/")} className="mt-6 rounded-2xl bg-accent px-5 py-3 text-sm text-white">
              Back to upload
            </button>
          </div>
        </div>
      </main>
    );
  }

  const nonEmptyCategories = CATEGORY_ORDER.filter((cat) => (groupedSheets.get(cat) || []).length > 0);

  return (
    <main className="min-h-screen bg-bg-deep">
      <AppHeader step={2} filename={file.filename} fileId={params.fileId} backHref="/" />

      <div className="mx-auto max-w-7xl px-6 py-10">

        {/* Hero */}
        <div className="rounded-[28px] border border-border-subtle bg-white px-8 py-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-text-tertiary">Workbook</div>
              <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-text-primary">{file.filename}</h1>
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-text-secondary">
                <span>
                  <span className="font-semibold text-text-primary">{file.sheets.length}</span> sheets
                </span>
                <span>
                  <span className="font-semibold text-text-primary">{nonEmptyCategories.length}</span> categories
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {nonEmptyCategories.map((cat) => {
                const count = (groupedSheets.get(cat) || []).length;
                return (
                  <div
                    key={cat}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] ${CATEGORY_META[cat].accent}`}
                  >
                    {cat} · {count}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="mt-8 flex items-center gap-1 rounded-2xl border border-border-subtle bg-white p-1 w-fit shadow-sm">
          {(["summary", "sheets"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-5 py-2.5 text-sm font-medium transition ${
                activeTab === tab ? "bg-accent text-white shadow-sm" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {tab === "summary" ? "Workbook Summary" : "Browse Sheets"}
            </button>
          ))}
        </div>

        {/* Summary tab */}
        {activeTab === "summary" && (
          <div className="mt-8">
            <SummarySheet fileId={params.fileId} file={file} />
          </div>
        )}

        {/* Sheets tab */}
        {activeTab === "sheets" && (
          <div className="mt-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-text-secondary">
                Sheets are grouped by workbook role. Click any sheet to inspect its formulas and tables.
              </p>
              <input
                ref={filterRef}
                onInput={handleFilter}
                placeholder="Search sheets…"
                className="rounded-2xl border border-border-subtle bg-white px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>

            <div ref={cardsRef} className="space-y-10">
              {CATEGORY_ORDER.map((category) => {
                const sheets = groupedSheets.get(category) || [];
                if (!sheets.length) return null;
                const meta = CATEGORY_META[category];
                return (
                  <section key={category}>
                    <div className="mb-4 flex items-center gap-3">
                      <div className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] font-medium ${meta.accent}`}>
                        {meta.label}
                      </div>
                      <div className="text-sm text-text-secondary">{meta.desc}</div>
                      <div className="ml-auto text-xs text-text-tertiary">
                        {sheets.length} sheet{sheets.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {sheets.map((sheet, index) => (
                        <button
                          key={sheet}
                          data-sheet-name={sheet}
                          onClick={() => router.push(`/workbook/${params.fileId}/${encodeURIComponent(sheet)}`)}
                          className="animate-fade-in-up group rounded-[24px] border border-border-subtle bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(0,0,0,0.07)]"
                          style={{ animationDelay: `${index * 40}ms` }}
                        >
                          <div className="flex items-center justify-between">
                            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${meta.accent} border`}>
                              <SheetIcon category={category} />
                            </div>
                            <div className="text-xs text-text-tertiary opacity-0 transition group-hover:opacity-100">
                              Open →
                            </div>
                          </div>
                          <div className="mt-3 font-semibold tracking-tight text-text-primary">{sheet}</div>
                          <div className="mt-1 text-xs text-text-secondary">{meta.desc}</div>
                          <div className={`mt-4 h-1 w-10 rounded-full ${meta.bar} transition-all group-hover:w-16`} />
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

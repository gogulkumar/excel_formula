"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { AppHeader } from "@/components/header";
import { SummarySheet } from "@/components/summary-sheet";
import { fetchFile } from "@/lib/api";
import type { FileEntry } from "@/lib/types";

export default function WorkbookPage() {
  const params = useParams<{ fileId: string }>();
  const router = useRouter();
  const [file, setFile] = useState<FileEntry | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const filterRef = useRef<HTMLInputElement | null>(null);
  const cardsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void fetchFile(params.fileId).then(setFile);
  }, [params.fileId]);

  function handleFilter() {
    const needle = filterRef.current?.value.toLowerCase() || "";
    const buttons = cardsRef.current?.querySelectorAll<HTMLButtonElement>("[data-sheet-name]");
    buttons?.forEach((button) => {
      const match = (button.dataset.sheetName || "").toLowerCase().includes(needle);
      button.style.display = match ? "" : "none";
    });
  }

  const sheetCards = useMemo(() => file?.sheets || [], [file]);

  if (!file) return <div className="p-8">Loading...</div>;

  return (
    <main className="min-h-screen bg-bg-deep">
      <AppHeader step={2} filename={file.filename} fileId={params.fileId} />
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-medium">Choose a sheet</h1>
            <p className="mt-2 text-text-secondary">Pick a tab to inspect formulas, tables, and metric trees.</p>
          </div>
          <div className="flex gap-3">
            <input ref={filterRef} onInput={handleFilter} placeholder="Filter sheets" className="rounded-2xl border border-border-subtle bg-white px-4 py-3" />
            <button className="rounded-2xl bg-accent px-5 py-3 text-white" onClick={() => setShowSummary((current) => !current)}>Summary Sheet</button>
          </div>
        </div>

        {showSummary ? (
          <div className="mt-8">
            <SummarySheet fileId={params.fileId} file={file} />
          </div>
        ) : null}

        <div ref={cardsRef} className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {sheetCards.map((sheet, index) => (
            <button
              key={sheet}
              data-sheet-name={sheet}
              onClick={() => router.push(`/workbook/${params.fileId}/${encodeURIComponent(sheet)}`)}
              className="animate-fade-in-up rounded-[28px] border border-border-subtle bg-white p-6 text-left shadow-sm"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="font-medium">{sheet}</div>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}


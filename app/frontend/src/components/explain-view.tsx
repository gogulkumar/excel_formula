"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";

function splitTechnical(explanation: string) {
  const parts = explanation.split("---FORMULA---");
  return {
    identity: parts[0]?.trim() || "",
    methodology: parts[1]?.trim() || "",
    formula: parts[2]?.trim() || "",
  };
}

function splitBlueprint(explanation: string) {
  const [dataFlow = "", rest = ""] = explanation.split("---BLUEPRINT_STEPS---");
  const [steps = "", rewrite = ""] = rest.split("---BLUEPRINT_OPTIMIZE---");
  return {
    dataFlow: dataFlow.trim(),
    steps: steps.trim(),
    rewrite: rewrite.trim(),
  };
}

function splitSnapshot(snapshot: string) {
  const [identity = "", narrative = "", formula = ""] = snapshot.split("---SNAP---");
  return { identity: identity.trim(), narrative: narrative.trim(), formula: formula.trim() };
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className={`rounded-full border px-3 py-1 text-xs transition-all duration-200 ${
        copied
          ? "border-teal/30 bg-teal/10 text-teal"
          : "border-border-subtle text-text-secondary hover:border-accent hover:text-accent"
      }`}
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

export function ExplainView({
  explanation,
  businessSummary,
  reconstruction,
  snapshot,
  explaining,
  summarizing,
  reconstructing,
  snapshotting,
  onExplain,
  onBusinessSummary,
  onReconstruct,
  onSnapshot,
}: {
  explanation: string;
  businessSummary: string;
  reconstruction: string;
  snapshot: string;
  explaining: boolean;
  summarizing: boolean;
  reconstructing: boolean;
  snapshotting: boolean;
  onExplain: () => void;
  onBusinessSummary: () => void;
  onReconstruct: () => void;
  onSnapshot: () => void;
}) {
  const [tab, setTab] = useState<"technical" | "business" | "blueprint">("technical");
  const technical = useMemo(() => splitTechnical(explanation), [explanation]);
  const blueprint = useMemo(() => splitBlueprint(reconstruction), [reconstruction]);
  const snap = useMemo(() => splitSnapshot(snapshot), [snapshot]);

  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border border-border-subtle bg-white" style={{ maxHeight: '100%' }}>
      <div className="flex-none flex flex-wrap gap-2 border-b border-border-subtle p-3">
        {([
          ["technical", "Technical", "bg-accent"],
          ["business", "Business", "bg-teal"],
          ["blueprint", "Blueprint", "bg-violet"],
        ] as const).map(([value, label, activeClass]) => (
          <button
            key={value}
            className={`rounded-full px-4 py-2 text-sm ${tab === value ? `${activeClass} text-white` : "bg-bg-elevated"}`}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-auto space-y-4 p-5">
        {(snapshot || snapshotting) && tab === "technical" ? (
          <div className="rounded-3xl border border-accent/15 bg-accent/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.2em] text-accent">Snapshot</div>
              {snapshot ? <CopyButton value={snapshot} /> : null}
            </div>
            {snapshot ? (
              <>
                <div className="prose prose-sm max-w-none"><ReactMarkdown>{snap.identity}</ReactMarkdown></div>
                <div className="prose prose-sm mt-3 max-w-none"><ReactMarkdown>{snap.narrative}</ReactMarkdown></div>
                <div className="mt-3 rounded-2xl bg-white px-4 py-3 font-mono-ui text-xs text-text-secondary">{snap.formula}</div>
              </>
            ) : (
              <div className="animate-shimmer h-28 rounded-2xl" />
            )}
          </div>
        ) : null}

        {tab === "technical" ? (
          explaining ? (
            <div className="space-y-3">
              <div className="animate-shimmer h-32 rounded-3xl" />
              <div className="animate-shimmer h-48 rounded-3xl" />
            </div>
          ) : explanation ? (
            <div className="space-y-4">
              <section className="rounded-3xl border border-accent/15 bg-accent/5 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs uppercase tracking-[0.2em] text-accent">Metric Identity</div>
                  <CopyButton value={technical.identity} />
                </div>
                <div className="prose prose-sm max-w-none"><ReactMarkdown>{technical.identity}</ReactMarkdown></div>
              </section>
              <section className="rounded-3xl border border-border-subtle bg-white p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs uppercase tracking-[0.2em] text-text-tertiary">Step-by-step Methodology</div>
                  <CopyButton value={technical.methodology} />
                </div>
                <div className="prose prose-sm max-w-none"><ReactMarkdown>{technical.methodology}</ReactMarkdown></div>
              </section>
              {technical.formula ? (
                <section className="rounded-3xl border border-accent/20 bg-white p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-xs uppercase tracking-[0.2em] text-text-tertiary">Mathematical Formula</div>
                    <CopyButton value={technical.formula} />
                  </div>
                  <div className="prose prose-sm max-w-none"><ReactMarkdown>{technical.formula}</ReactMarkdown></div>
                </section>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-3xl border-2 border-dashed border-accent/25 bg-accent/3 p-6 text-center">
                <div className="text-sm font-medium text-text-secondary">Get an analyst-grade breakdown of this formula</div>
                <div className="mt-1 text-xs text-text-tertiary">Traces every dependency and explains the logic in plain English</div>
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  <button className="rounded-2xl bg-accent px-5 py-2.5 text-sm text-white shadow-sm transition hover:opacity-90" onClick={onExplain}>
                    Technical Breakdown
                  </button>
                  <button className="rounded-2xl border border-border-subtle bg-white px-5 py-2.5 text-sm text-text-secondary transition hover:border-accent hover:text-accent" onClick={onSnapshot}>
                    Formula Snapshot
                  </button>
                </div>
              </div>
            </div>
          )
        ) : null}

        {tab === "business" ? (
          summarizing ? (
            <div className="animate-shimmer h-40 rounded-3xl" />
          ) : businessSummary ? (
            <section className="rounded-3xl border border-teal/20 bg-teal/5 p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs uppercase tracking-[0.2em] text-teal">Executive Summary</div>
                <CopyButton value={businessSummary} />
              </div>
              <div className="prose prose-sm max-w-none"><ReactMarkdown>{businessSummary}</ReactMarkdown></div>
            </section>
          ) : (
            <div className="rounded-3xl border-2 border-dashed border-teal/25 bg-teal/3 p-6 text-center">
              <div className="text-sm font-medium text-text-secondary">Plain-English business summary for executives</div>
              <div className="mt-1 text-xs text-text-tertiary">No cell references — just what the metric means and why it matters</div>
              <button className="mt-4 rounded-2xl bg-teal px-5 py-2.5 text-sm text-white shadow-sm transition hover:opacity-90" onClick={onBusinessSummary}>
                Generate Business Summary
              </button>
            </div>
          )
        ) : null}

        {tab === "blueprint" ? (
          reconstructing ? (
            <div className="space-y-3">
              <div className="animate-shimmer h-24 rounded-3xl" />
              <div className="animate-shimmer h-56 rounded-3xl" />
              <div className="animate-shimmer h-32 rounded-3xl" />
            </div>
          ) : reconstruction ? (
            <div className="space-y-4">
              <section className="rounded-3xl border border-violet/20 bg-violet/5 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs uppercase tracking-[0.2em] text-violet">Data Flow</div>
                  <CopyButton value={blueprint.dataFlow} />
                </div>
                <div className="prose prose-sm max-w-none"><ReactMarkdown>{blueprint.dataFlow}</ReactMarkdown></div>
              </section>
              <section className="rounded-3xl border border-border-subtle bg-white p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs uppercase tracking-[0.2em] text-text-tertiary">Step-by-step Rebuild</div>
                  <CopyButton value={blueprint.steps} />
                </div>
                <div className="prose prose-sm max-w-none"><ReactMarkdown>{blueprint.steps}</ReactMarkdown></div>
              </section>
              <section className="rounded-3xl border border-border-subtle bg-white p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs uppercase tracking-[0.2em] text-text-tertiary">Optimization Notes</div>
                  <CopyButton value={blueprint.rewrite} />
                </div>
                <div className="prose prose-sm max-w-none"><ReactMarkdown>{blueprint.rewrite}</ReactMarkdown></div>
              </section>
            </div>
          ) : (
            <div className="rounded-3xl border-2 border-dashed border-violet/25 bg-violet/3 p-6 text-center">
              <div className="text-sm font-medium text-text-secondary">Step-by-step formula reconstruction + optimization notes</div>
              <div className="mt-1 text-xs text-text-tertiary">Shows data flow, rebuild steps, and where simplifications are possible</div>
              <button className="mt-4 rounded-2xl bg-violet px-5 py-2.5 text-sm text-white shadow-sm transition hover:opacity-90" onClick={onReconstruct}>
                Generate Blueprint
              </button>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}

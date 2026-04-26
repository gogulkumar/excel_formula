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
  return (
    <button
      onClick={() => void navigator.clipboard.writeText(value)}
      className="rounded-full border border-border-subtle px-3 py-1 text-xs text-text-secondary transition hover:border-accent hover:text-accent"
    >
      Copy
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
    <div className="rounded-3xl border border-border-subtle bg-white">
      <div className="flex flex-wrap gap-2 border-b border-border-subtle p-3">
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
      <div className="space-y-4 p-5">
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
          explanation ? (
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
            <div className="flex flex-wrap gap-3">
              <button className="rounded-2xl bg-accent px-5 py-3 text-white" onClick={onExplain} disabled={explaining}>
                {explaining ? "Generating..." : "Technical Breakdown"}
              </button>
              <button className="rounded-2xl border border-border-subtle bg-white px-5 py-3 text-text-secondary" onClick={onSnapshot} disabled={snapshotting}>
                {snapshotting ? "Generating..." : "Formula Snapshot"}
              </button>
            </div>
          )
        ) : null}

        {tab === "business" ? (
          businessSummary ? (
            <section className="rounded-3xl border border-teal/20 bg-teal/5 p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs uppercase tracking-[0.2em] text-teal">Executive Summary</div>
                <CopyButton value={businessSummary} />
              </div>
              <div className="prose prose-sm max-w-none"><ReactMarkdown>{businessSummary}</ReactMarkdown></div>
            </section>
          ) : (
            <button className="rounded-2xl bg-teal px-5 py-3 text-white" onClick={onBusinessSummary} disabled={summarizing}>
              {summarizing ? "Generating..." : "Business Summary"}
            </button>
          )
        ) : null}

        {tab === "blueprint" ? (
          reconstruction ? (
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
            <button className="rounded-2xl bg-violet px-5 py-3 text-white" onClick={onReconstruct} disabled={reconstructing}>
              {reconstructing ? "Generating..." : "Formula Blueprint"}
            </button>
          )
        ) : null}
      </div>
    </div>
  );
}

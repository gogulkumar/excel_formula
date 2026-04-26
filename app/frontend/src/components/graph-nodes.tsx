"use client";

import type { NodeProps } from "@xyflow/react";

import type { RangeRef, TraceNode } from "@/lib/types";

function formatValue(value: string) {
  const numeric = Number(String(value).replace(/,/g, ""));
  if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
    const abs = Math.abs(numeric);
    if (abs >= 1_000_000) return `${(numeric / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(numeric / 1_000).toFixed(1)}K`;
    if (!Number.isInteger(numeric)) return numeric.toFixed(2);
    return String(numeric);
  }
  return value.length > 20 ? `${value.slice(0, 20)}…` : value || "Empty";
}

function buildComposition(node: TraceNode) {
  if (!node.formula) return "Base input";
  const labels = node.deps.map((dep) => dep.meta || `${dep.sheet}!${dep.cell}`);
  const formula = node.formula.toUpperCase();
  const fn = /^=([A-Z][A-Z0-9_]*)\(/.exec(formula)?.[1];
  if (fn && labels.length) return `${fn}(${labels.join(", ")})`;
  if (formula.includes("+")) return labels.join(" + ");
  if (formula.includes("-")) return labels.join(" - ");
  if (formula.includes("*")) return labels.join(" × ");
  if (formula.includes("/")) return labels.join(" ÷ ");
  return node.formula;
}

export function TraceNodeComponent({ data }: NodeProps) {
  const node = data.node as TraceNode;
  const description = data.description as string | undefined;
  return (
    <div className={`w-[280px] rounded-2xl border bg-white p-4 shadow-sm ${node.external ? "border-rose" : node.formula ? "border-accent" : "border-teal"}`}>
      <div className="font-mono-ui text-xs text-text-secondary">{node.sheet}!{node.cell}</div>
      <div className="mt-2 text-sm font-semibold">{node.meta || description || "Formula node"}</div>
      <div className="mt-3 rounded-2xl bg-bg-elevated px-3 py-2 font-mono-ui text-sm text-text-primary">{node.formula || node.value || "Empty"}</div>
      {node.ranges?.length ? (
        <div className="mt-3 space-y-2">
          {node.ranges.map((range) => (
            <div key={`${range.sheet}-${range.range}`} className="rounded-xl border border-violet/20 bg-violet/5 px-3 py-2 text-xs text-violet">
              {range.sheet}!{range.range}
              {range.headers?.length ? <div className="mt-1 text-text-secondary">{range.headers.join(" · ")}</div> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function RangeNodeComponent({ data }: NodeProps) {
  const range = data.range as RangeRef;
  return (
    <div className="w-[240px] rounded-2xl border border-violet bg-white p-4 shadow-sm">
      <div className="font-mono-ui text-xs text-violet">{range.sheet}!{range.range}</div>
      <div className="mt-2 text-xs text-text-secondary">{(range.headers || []).join(" • ")}</div>
    </div>
  );
}

export function TreeNodeComponent({ data }: NodeProps) {
  const direction = data.direction as "selected" | "up" | "down";
  const node = data.node as TraceNode;
  const title = node.meta && node.meta !== `${node.sheet}!${node.cell}` ? node.meta : `${node.sheet}!${node.cell}`;
  const hasLabel = title !== `${node.sheet}!${node.cell}`;
  const color = direction === "up" ? "border-blue" : direction === "selected" ? "border-accent" : "border-teal";
  const badge =
    node.external ? "Ext." :
    node.truncated ? "more" :
    direction === "up" ? "used by" :
    direction === "selected" ? "selected" :
    node.formula ? "formula" : "input";
  return (
    <div className={`w-[260px] rounded-[24px] border-2 ${color} bg-white p-4 shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-text-primary">{title}</div>
          {hasLabel ? (
            <div className="mt-1 font-mono-ui text-[11px] text-accent/80">{node.sheet}!{node.cell}</div>
          ) : null}
        </div>
        <span className="rounded-full bg-bg-elevated px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-text-secondary">{badge}</span>
      </div>
      <div className="mt-4 font-mono-ui text-xl font-semibold tabular-nums text-text-primary">= {formatValue(node.value)}</div>
      <div className="mt-3 rounded-2xl bg-bg-elevated px-3 py-2 text-xs leading-5 text-text-secondary">{buildComposition(node)}</div>
      {node.formula ? (
        <div className="mt-3 line-clamp-2 font-mono-ui text-[11px] text-text-tertiary">{node.formula}</div>
      ) : null}
    </div>
  );
}

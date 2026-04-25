"use client";

import type { NodeProps } from "@xyflow/react";

import type { RangeRef, TraceNode } from "@/lib/types";

export function TraceNodeComponent({ data }: NodeProps) {
  const node = data.node as TraceNode;
  const description = data.description as string | undefined;
  return (
    <div className={`w-[280px] rounded-2xl border bg-white p-4 shadow-sm ${node.external ? "border-rose" : node.formula ? "border-accent" : "border-teal"}`}>
      <div className="font-mono-ui text-xs text-text-secondary">{node.sheet}!{node.cell}</div>
      <div className="mt-2 text-sm font-medium">{node.meta || description}</div>
      <div className="mt-2 line-clamp-3 font-mono-ui text-xs text-text-secondary">{node.formula || node.value || "Empty"}</div>
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
  const description = data.description as string | undefined;
  const color = direction === "up" ? "border-blue" : direction === "selected" ? "border-accent" : "border-teal";
  return (
    <div className={`w-[240px] rounded-2xl border-2 ${color} bg-white p-4 shadow-sm`}>
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono-ui text-xs">{node.sheet}!{node.cell}</div>
        <span className="rounded-full bg-bg-elevated px-2 py-1 text-[10px] uppercase tracking-wide text-text-secondary">{direction}</span>
      </div>
      <div className="mt-2 text-sm font-medium">{node.meta || description}</div>
      <div className="mt-2 line-clamp-2 font-mono-ui text-xs text-text-secondary">{node.formula || node.value || "Empty"}</div>
    </div>
  );
}

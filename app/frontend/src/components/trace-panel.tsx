"use client";

import { DiagramIcon, ExplainIcon, TreeIcon } from "@/components/icons";
import { ExplainView } from "@/components/explain-view";
import { FormulaGraph } from "@/components/formula-graph";
import { TraceTree } from "@/components/trace-tree";
import type { TraceNode } from "@/lib/types";

export function TracePanel({
  trace,
  traceUp,
  view,
  onViewChange,
  onClose,
  explanation,
  explaining,
  onExplain,
  businessSummary,
  summarizing,
  onBusinessSummary,
  reconstruction,
  reconstructing,
  onReconstruct,
  snapshot,
  snapshotting,
  onSnapshot,
}: {
  trace: TraceNode | null;
  traceUp: TraceNode | null;
  view: "tree" | "diagram" | "explain";
  onViewChange: (view: "tree" | "diagram" | "explain") => void;
  onClose: () => void;
  explanation: string;
  explaining: boolean;
  onExplain: () => void;
  businessSummary: string;
  summarizing: boolean;
  onBusinessSummary: () => void;
  reconstruction: string;
  reconstructing: boolean;
  onReconstruct: () => void;
  snapshot: string;
  snapshotting: boolean;
  onSnapshot: () => void;
}) {
  return (
    <aside className="animate-slide-in-right flex h-full flex-col rounded-[32px] border border-border-subtle bg-white">
      <div className="border-b border-border-subtle p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-text-tertiary">Tracing</div>
            <h2 className="mt-2 font-mono-ui text-lg">{trace ? `${trace.sheet}!${trace.cell}` : "Loading"}</h2>
            <div className="mt-2 line-clamp-2 font-mono-ui text-xs text-text-secondary">{trace?.formula || trace?.value || "Tracing dependencies..."}</div>
          </div>
          <button onClick={onClose} className="rounded-full border border-border-subtle px-3 py-2 text-sm">Close</button>
        </div>
        <div className="mt-4 flex gap-2">
          {([
            { value: "tree", icon: <TreeIcon active={view === "tree"} /> },
            { value: "diagram", icon: <DiagramIcon active={view === "diagram"} /> },
            { value: "explain", icon: <ExplainIcon active={view === "explain"} /> },
          ] as const).map(({ value, icon }) => (
            <button
              key={value}
              onClick={() => onViewChange(value)}
              className={`rounded-full px-4 py-2 text-sm ${view === value ? "bg-accent text-white" : "bg-bg-elevated"}`}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-5">
        {!trace ? (
          <div className="animate-shimmer h-52 rounded-3xl" />
        ) : view === "tree" ? (
          <TraceTree trace={trace} traceUp={traceUp} />
        ) : view === "diagram" ? (
          <FormulaGraph trace={trace} />
        ) : (
          <ExplainView
            explanation={explanation}
            businessSummary={businessSummary}
            reconstruction={reconstruction}
            snapshot={snapshot}
            explaining={explaining}
            summarizing={summarizing}
            reconstructing={reconstructing}
            snapshotting={snapshotting}
            onExplain={onExplain}
            onBusinessSummary={onBusinessSummary}
            onReconstruct={onReconstruct}
            onSnapshot={onSnapshot}
          />
        )}
      </div>
    </aside>
  );
}

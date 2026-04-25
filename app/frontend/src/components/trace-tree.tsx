"use client";

import { Background, Controls, MiniMap, ReactFlow } from "@xyflow/react";

import { TreeNodeComponent } from "@/components/graph-nodes";
import { traceToTree } from "@/lib/graph";
import { buildExpandedFormula } from "@/lib/utils";
import type { TraceNode } from "@/lib/types";

export function TraceTree({ trace, traceUp }: { trace: TraceNode; traceUp?: TraceNode | null }) {
  const { nodes, edges } = traceToTree(trace, traceUp || undefined);
  return (
    <div className="h-[720px] overflow-hidden rounded-3xl border border-border-subtle bg-bg-deep">
      {trace.formula ? (
        <div className="border-b border-border-subtle bg-white p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-text-tertiary">Expanded formula</div>
          <div className="mt-2 font-mono-ui text-sm">{buildExpandedFormula(trace)}</div>
        </div>
      ) : null}
      <ReactFlow nodes={nodes} edges={edges} fitView nodeTypes={{ treeNode: TreeNodeComponent }} minZoom={0.1} maxZoom={2.5}>
        <Background gap={24} />
        <MiniMap />
        <Controls />
      </ReactFlow>
    </div>
  );
}


"use client";

import { Background, Controls, ReactFlow } from "@xyflow/react";

import { RangeNodeComponent, TraceNodeComponent } from "@/components/graph-nodes";
import { traceToGraph } from "@/lib/graph";
import type { TraceNode } from "@/lib/types";

export function FormulaGraph({ trace }: { trace: TraceNode }) {
  const { nodes, edges } = traceToGraph(trace);
  return (
    <div className="h-[720px] overflow-hidden rounded-3xl border border-border-subtle bg-bg-deep">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        minZoom={0.15}
        maxZoom={2.5}
        nodeTypes={{ traceNode: TraceNodeComponent, rangeNode: RangeNodeComponent }}
      >
        <Background gap={24} />
        <Controls />
      </ReactFlow>
    </div>
  );
}


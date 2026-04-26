"use client";

import { ReactFlow, Background, Controls } from "@xyflow/react";

import { TreeNodeComponent } from "@/components/graph-nodes";
import { traceToTree } from "@/lib/graph";
import type { TraceNode } from "@/lib/types";

export function MetricFlow({ trace, traceUp }: { trace: TraceNode; traceUp?: TraceNode | null }) {
  const { nodes, edges } = traceToTree(trace, traceUp || undefined);
  return (
    <div className="h-[520px] rounded-3xl border border-border-subtle bg-white">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={{ treeNode: TreeNodeComponent }} fitView minZoom={0.1} maxZoom={2.5}>
        <Background gap={24} color="#E5E3DF" />
        <Controls />
      </ReactFlow>
    </div>
  );
}

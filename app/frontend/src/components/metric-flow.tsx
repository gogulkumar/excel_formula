"use client";

import { useEffect } from "react";
import { ReactFlow, Background, Controls, useNodesState, useEdgesState } from "@xyflow/react";

import { TreeNodeComponent } from "@/components/graph-nodes";
import { traceToTree } from "@/lib/graph";
import type { TraceNode } from "@/lib/types";

const NODE_TYPES = { treeNode: TreeNodeComponent };

export function MetricFlow({ trace, traceUp }: { trace: TraceNode; traceUp?: TraceNode | null }) {
  const { nodes: initialNodes, edges: initialEdges } = traceToTree(trace, traceUp || undefined);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    const { nodes: n, edges: e } = traceToTree(trace, traceUp || undefined);
    setNodes(n);
    setEdges(e);
  }, [trace, traceUp, setNodes, setEdges]);

  return (
    <div className="h-[520px] rounded-3xl border border-border-subtle bg-white">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        minZoom={0.1}
        maxZoom={2.5}
      >
        <Background gap={24} color="#E5E3DF" />
        <Controls />
      </ReactFlow>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Background, Controls, ReactFlow, useEdgesState, useNodesState } from "@xyflow/react";

import { RangeNodeComponent, TraceNodeComponent } from "@/components/graph-nodes";
import { traceToGraph } from "@/lib/graph";
import type { TraceNode } from "@/lib/types";

const NODE_TYPES = { traceNode: TraceNodeComponent, rangeNode: RangeNodeComponent };

function pruneTrace(node: TraceNode, maxDepth: number, depth = 0): TraceNode {
  if (depth >= maxDepth) return { ...node, deps: [], ranges: [], truncated: true };
  return { ...node, deps: node.deps.map((d) => pruneTrace(d, maxDepth, depth + 1)) };
}

export function FormulaGraph({ trace }: { trace: TraceNode }) {
  const [depth, setDepth] = useState(1);
  const pruned = pruneTrace(trace, depth);
  const { nodes: initialNodes, edges: initialEdges } = traceToGraph(pruned);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    const { nodes: n, edges: e } = traceToGraph(pruneTrace(trace, depth));
    setNodes(n);
    setEdges(e);
  }, [trace, depth, setNodes, setEdges]);

  return (
    <div className="flex h-[720px] flex-col overflow-hidden rounded-3xl border border-border-subtle bg-bg-deep">
      <div className="flex items-center gap-4 border-b border-border-subtle bg-white px-4 py-2.5">
        <span className="text-xs uppercase tracking-[0.16em] text-text-tertiary">Depth</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((d) => (
            <button
              key={d}
              onClick={() => setDepth(d)}
              className={`h-7 w-7 rounded-lg text-xs font-medium transition ${
                depth === d ? "bg-accent text-white" : "bg-bg-elevated text-text-secondary hover:bg-border-subtle"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <span className="text-xs text-text-tertiary">
          {nodes.length} node{nodes.length !== 1 ? "s" : ""} · {edges.length} edge{edges.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          minZoom={0.15}
          maxZoom={2.5}
        >
          <Background gap={24} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

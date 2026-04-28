import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";

import { describe } from "@/lib/utils";
import type { TraceNode } from "@/lib/types";

const NODE_WIDTH = 280;
const NODE_HEIGHT = 90;

export function layoutGraph(nodes: Node[], edges: Edge[], direction: "LR" | "TB" = "LR") {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 40, ranksep: 70 });
  nodes.forEach((node) => g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach((edge) => g.setEdge(edge.source, edge.target));
  dagre.layout(g);
  return nodes.map((node) => {
    const positioned = g.node(node.id);
    return {
      ...node,
      position: {
        x: positioned.x - NODE_WIDTH / 2,
        y: positioned.y - NODE_HEIGHT / 2,
      },
    };
  });
}

export function traceToGraph(root: TraceNode) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const seen = new Set<string>();
  const walk = (node: TraceNode) => {
    const id = `${node.sheet}!${node.cell}`;
    if (!seen.has(id)) {
      seen.add(id);
      nodes.push({
        id,
        type: "traceNode",
        data: { node, description: describe(node) },
        position: { x: 0, y: 0 },
      });
      node.ranges.forEach((range) => {
        const rangeId = `${id}:${range.sheet}!${range.range}`;
        nodes.push({
          id: rangeId,
          type: "rangeNode",
          data: { range },
          position: { x: 0, y: 0 },
        });
        edges.push({
          id: `${id}->${rangeId}`,
          source: id,
          target: rangeId,
          animated: true,
          style: { stroke: "#7C3AED", strokeDasharray: "6 4" },
        });
      });
    }
    node.deps.forEach((dep) => {
      const depId = `${dep.sheet}!${dep.cell}`;
      edges.push({
        id: `${id}->${depId}`,
        source: id,
        target: depId,
        style: { stroke: "#0F766E" },
      });
      walk(dep);
    });
  };
  walk(root);
  return { nodes: layoutGraph(nodes, edges, "LR"), edges };
}

export function traceToTree(root: TraceNode, upTrace?: TraceNode) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const seenNodes = new Set<string>();
  const seenEdges = new Set<string>();

  const add = (node: TraceNode, direction: "selected" | "down" | "up") => {
    const id = `${direction}:${node.sheet}!${node.cell}`;
    let isNew = false;
    if (!seenNodes.has(id)) {
      isNew = true;
      seenNodes.add(id);
      nodes.push({
        id,
        type: "treeNode",
        data: { node, direction, description: describe(node) },
        position: { x: 0, y: 0 },
      });
    }
    return { id, isNew };
  };

  const walkDown = (node: TraceNode, parentId?: string) => {
    const { id, isNew } = add(node, parentId ? "down" : "selected");
    if (parentId) {
      const edgeId = `${parentId}->${id}`;
      if (!seenEdges.has(edgeId)) {
        seenEdges.add(edgeId);
        edges.push({ id: edgeId, source: parentId, target: id, type: "smoothstep", style: { stroke: "#0F766E", strokeWidth: 2 } });
      }
    }
    if (isNew) {
      node.deps.forEach((dep) => walkDown(dep, id));
    }
    return id;
  };

  const rootId = walkDown(root);
  const walkUp = (node: TraceNode, parentId: string) => {
    node.deps.forEach((dep) => {
      const { id, isNew } = add(dep, "up");
      const edgeId = `${id}->${parentId}`;
      if (!seenEdges.has(edgeId)) {
        seenEdges.add(edgeId);
        edges.push({ id: edgeId, source: id, target: parentId, type: "smoothstep", style: { stroke: "#2563EB", strokeWidth: 2 } });
      }
      if (isNew) {
        walkUp(dep, id);
      }
    });
  };
  if (upTrace) walkUp(upTrace, rootId);
  return { nodes: layoutGraph(nodes, edges, "TB"), edges };
}

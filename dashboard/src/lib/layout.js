// dashboard/src/lib/layout.js
//
// Auto-layout the timeline using dagre, so nodes don't just pile up straight
// down without limit (an old problem: manual x/y positions per category).
// Called again every time the event list changes (see FlowCanvas.jsx) -- at
// a realistic event scale (tens-to-hundreds per session) this is cheap
// enough to recompute every time, no need for incremental memoization.

import dagre from "dagre";

const NODE_WIDTH = 240;
const NODE_HEIGHT = 64;

/**
 * @param {Array} nodes  React Flow nodes without a final position (position can be {x:0,y:0})
 * @param {Array} edges  React Flow edges (source/target id string)
 * @param {"LR"|"TB"} direction
 */
export function layoutTimeline(nodes, edges, direction = "LR") {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: direction, nodesep: 32, ranksep: 90 });

  for (const node of nodes) {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target);
  }

  dagre.layout(graph);

  const layoutedNodes = nodes.map((node) => {
    const { x, y } = graph.node(node.id);
    // dagre gives the node's CENTER point -- shift it back to the top-left
    // corner to match React Flow's `position` convention.
    return { ...node, position: { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 } };
  });

  return { nodes: layoutedNodes, edges };
}

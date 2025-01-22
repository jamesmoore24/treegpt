"use client";

import ReactFlow, { Background, Controls, ReactFlowInstance } from "reactflow";
import { Node, Edge } from "reactflow";
export function ChatGraph({
  nodes,
  edges,
  onInit,
  splitPosition,
}: {
  nodes: Node[];
  edges: Edge[];
  onInit: (reactFlowInstance: ReactFlowInstance) => void;
  splitPosition: number;
}) {
  return (
    <div
      style={{ width: `${100 - splitPosition}%` }}
      className="border-l h-full"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onInit={onInit}
        fitView
        fitViewOptions={{ padding: 0.2, duration: 500 }}
        minZoom={0.1}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
        className="h-full"
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}

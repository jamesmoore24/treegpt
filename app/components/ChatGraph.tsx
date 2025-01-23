"use client";

import ReactFlow, { Background, Controls, ReactFlowInstance } from "reactflow";
import { Node, Edge } from "reactflow";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

export function ChatGraph({
  nodes,
  edges,
  onInit,
  splitPosition,
  isSmallScreen,
}: {
  nodes: Node[];
  edges: Edge[];
  onInit: (reactFlowInstance: ReactFlowInstance) => void;
  splitPosition: number;
  isSmallScreen: boolean;
}) {
  const [key, setKey] = useState(0);

  // Force re-render on major layout changes
  useEffect(() => {
    setKey((prev) => prev + 1);
  }, [splitPosition]);

  return (
    <div
      style={{
        width: isSmallScreen ? "100%" : `${100 - splitPosition}%`,
        height: isSmallScreen ? `${100 - splitPosition}%` : "100%",
      }}
      className={cn(isSmallScreen ? "border-t" : "border-l", "h-full")}
      key={key}
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

import { cn } from "@/lib/utils";
import { ChatMessage } from "./ChatMessage";
import { Message } from "@/types/chat";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { MessageSquare } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { Controls, ReactFlowInstance } from "reactflow";
import ReactFlow from "reactflow";
import { Background, Node, Edge } from "reactflow";

interface ChatWindowProps {
  messages: Message[];
  isSidebarOpen: boolean;
  input: string;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
}

export function ChatWindow({
  messages,
  isSidebarOpen,
  input,
  onInputChange,
  onSubmit,
  isLoading,
}: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  const [splitPosition, setSplitPosition] = useState(50); // percentage
  const [isDragging, setIsDragging] = useState(false);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    setReactFlowInstance(instance);
    instance.fitView({ padding: 0.2 });
  }, []);

  // Fit view whenever nodes change
  useEffect(() => {
    if (reactFlowInstance && nodes.length > 0) {
      setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.2 });
      }, 0);
    }
  }, [nodes, reactFlowInstance]);

  useEffect(() => {
    const newNodes: Node[] = [];
    for (let i = 0; i < messages.length; i += 2) {
      const query = messages[i];
      const response = messages[i + 1];
      // Only create node if we have both query and response
      if (query && response) {
        newNodes.push({
          id: `node-${i / 2}`,
          position: {
            x: 200,
            y: (i / 2) * 150,
          },
          data: {
            label: (
              <div
                style={{
                  maxWidth: 200,
                  whiteSpace: "pre-wrap",
                  fontSize: "12px",
                }}
              >
                <strong>Q: </strong>
                {query.content.substring(0, 50)}...
                <br />
                <strong>A: </strong>
                {response.content.substring(0, 50)}...
              </div>
            ),
          },
          style: {
            width: 220,
            padding: "10px",
          },
          type: "default",
        });
      }
    }

    setNodes(newNodes);

    const newEdges: Edge[] = newNodes.slice(1).map((_, index) => ({
      id: `edge-${index}`,
      source: `node-${index}`,
      target: `node-${index + 1}`,
      type: "smoothstep",
      animated: true,
      style: { stroke: "#333", strokeWidth: 2 },
    }));

    setEdges(newEdges);
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        const windowWidth = window.innerWidth;
        const percentage = (e.clientX / windowWidth) * 100;
        setSplitPosition(Math.min(Math.max(percentage, 20), 80)); // Limit between 20% and 80%
      }
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-48px)]">
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Side */}
        <div
          style={{ width: `${splitPosition}%` }}
          className="flex flex-col h-full"
        >
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <ChatMessage key={idx} message={msg} />
              ))}
              {isLoading && (
                <div className="flex justify-center">
                  <div className="animate-bounce space-x-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full inline-block" />
                    <span className="w-2 h-2 bg-gray-400 rounded-full inline-block animate-bounce [animation-delay:0.2s]" />
                    <span className="w-2 h-2 bg-gray-400 rounded-full inline-block animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
          <form onSubmit={onSubmit} className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={onInputChange}
                placeholder="Type your message..."
                className="flex-1"
                disabled={isLoading}
              />
              <Button type="submit" disabled={isLoading}>
                <MessageSquare className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>

        {/* Resizer */}
        <div
          className="w-1 bg-gray-200 hover:bg-gray-400 cursor-col-resize active:bg-gray-600"
          onMouseDown={handleMouseDown}
        />

        {/* Graph Side */}
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
      </div>
    </div>
  );
}

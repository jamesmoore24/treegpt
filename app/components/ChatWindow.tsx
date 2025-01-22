import { cn } from "@/lib/utils";
import { ChatMessage } from "./ChatMessage";
import { Message } from "@/types/chat";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { ArrowUp, ChevronUp, MessageSquare } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { Controls, ReactFlowInstance } from "reactflow";
import ReactFlow from "reactflow";
import { Background, Node, Edge } from "reactflow";
import { ChatGraph } from "./ChatGraph";
import { Textarea } from "./ui/textarea";
interface ChatWindowProps {
  messages: Message[];
  isSidebarOpen: boolean;
  input: string;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  isLoadingFirstToken: boolean;
}

export function ChatWindow({
  messages,
  isSidebarOpen,
  input,
  onInputChange,
  onSubmit,
  isLoading,
  isLoadingFirstToken,
}: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [currentChatIndex, setCurrentChatIndex] = useState<number>(0);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  const [splitPosition, setSplitPosition] = useState(50); // percentage
  const [isDragging, setIsDragging] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("GPT-4");

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
      const nodeIndex = i / 2;
      // Only create node if we have both query and response
      if (query && response) {
        newNodes.push({
          id: `node-${nodeIndex}`,
          position: {
            x: 200,
            y: nodeIndex * 150,
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
                {query.content.substring(0, 50)}{" "}
                {query.content.length > 50 ? "..." : ""}
                <br />
                <strong>A: </strong>
                {response.content.substring(0, 50)}{" "}
                {response.content.length > 50 ? "..." : ""}
              </div>
            ),
          },
          style: {
            width: 220,
            padding: "10px",
            border:
              nodeIndex === currentChatIndex ? "2px solid #ff0000" : undefined,
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
      type: "default",
      style: { stroke: "#333", strokeWidth: 2 },
    }));

    setEdges(newEdges);
  }, [messages, currentChatIndex]);

  // Update currentChatIndex when new messages come in
  useEffect(() => {
    setCurrentChatIndex(Math.floor((messages.length - 1) / 2));
  }, [messages.length]);

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
              {isLoadingFirstToken && (
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
          <div className="border-t">
            <form onSubmit={onSubmit} className="p-4 flex flex-col gap-2">
              <Textarea
                value={input}
                onChange={onInputChange}
                placeholder="Type your message..."
                className="flex-1"
                disabled={isLoading}
                rows={
                  input.split("\n").length > 1
                    ? Math.min(input.split("\n").length, 12)
                    : 1
                }
                onKeyDown={(e) => {
                  const lineCount = input.split("\n").length;
                  if (e.key === "Enter") {
                    if (lineCount <= 3 && !e.shiftKey) {
                      e.preventDefault();
                      onSubmit(e);
                    } else if (lineCount <= 3 && e.shiftKey) {
                      // Allow new line with Shift+Enter when under 3 lines
                      return;
                    } else if (lineCount > 3) {
                      // After 4 lines, both Enter and Shift+Enter just create new lines
                      return;
                    }
                  }
                }}
              />
              <div className="flex items-center justify-between">
                <div className="flex gap-4 items-center text-sm text-muted-foreground">
                  <span>Tokens: ~{Math.ceil(input.length / 4)}</span>
                  <span>
                    Est. Cost: ${((input.length / 4) * 0.000015).toFixed(6)}
                  </span>
                  <div className="relative">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      onClick={() => setModelMenuOpen(!modelMenuOpen)}
                    >
                      {selectedModel || "GPT-4"}
                      <ChevronUp
                        className={cn(
                          "ml-2 h-4 w-4",
                          modelMenuOpen ? "rotate-180" : ""
                        )}
                      />
                    </Button>
                    {modelMenuOpen && (
                      <div className="absolute bottom-full mb-1 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                        <div className="py-1" role="menu">
                          {[
                            "GPT-4o-mini",
                            "GPT-4o",
                            "GPT-3.5",
                            "Claude",
                            "Gemini",
                          ].map((model) => (
                            <button
                              key={model}
                              className={cn(
                                "block w-full px-4 py-2 text-sm text-left hover:bg-gray-100",
                                selectedModel === model ? "bg-gray-50" : ""
                              )}
                              role="menuitem"
                              onClick={() => {
                                setSelectedModel(model);
                                setModelMenuOpen(false);
                              }}
                            >
                              {model}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <div className="h-4 w-4 relative">
                      <div className="absolute inset-0 border-2 border-current rounded-sm" />
                      <div className="absolute inset-[30%] bg-current rounded-full" />
                    </div>
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Resizer */}
        <div
          className="w-1 bg-gray-200 hover:bg-gray-400 cursor-col-resize active:bg-gray-600"
          onMouseDown={handleMouseDown}
        />

        <ChatGraph
          nodes={nodes}
          edges={edges}
          onInit={onInit}
          splitPosition={splitPosition}
        />
      </div>
    </div>
  );
}

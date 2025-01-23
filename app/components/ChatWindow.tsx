import { cn } from "@/lib/utils";
import { ChatMessage } from "./ChatMessage";
import { Message } from "@/types/chat";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { ArrowUp, ChevronUp, MessageSquare } from "lucide-react";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Controls, ReactFlowInstance } from "reactflow";
import ReactFlow from "reactflow";
import { Background, Node, Edge } from "reactflow";
import { ChatNode } from "@/types/chat";
import { ChatGraph } from "./ChatGraph";
import { Textarea } from "./ui/textarea";
import { debounce } from "lodash";

interface ChatWindowProps {
  messageContext: ChatNode[];
  chatNodes: Map<string, ChatNode>;
  currentChatId: string;
  isSidebarOpen: boolean;
  input: string;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  isLoadingFirstToken: boolean;
}

export function ChatWindow({
  messageContext,
  chatNodes,
  currentChatId,
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
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth < 768); // 768px is Tailwind's md breakpoint
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);

    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    setReactFlowInstance(instance);
    instance.fitView({ padding: 0.2 });
  }, []);

  // Debounced fit view
  const debouncedFitView = useMemo(
    () =>
      debounce((instance: ReactFlowInstance) => {
        requestAnimationFrame(() => {
          instance?.fitView({ padding: 0.2, duration: 200 });
        });
      }, 250),
    []
  );

  // Update nodes with delay
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];
      const queue: ChatNode[] = [];
      const levels: Map<string, number> = new Map();

      // Start with root node
      console.log("chatNodes", chatNodes);
      console.log("currentChatId", currentChatId);
      console.log("messageContext", messageContext);

      const rootNode = chatNodes.get(`${currentChatId}-0`);
      if (rootNode) {
        queue.push(rootNode);
        levels.set(`${currentChatId}-0`, 0);
      }

      // BFS traversal
      let currentLevel = 0;
      let nodesInCurrentLevel = 1;
      let nodesInNextLevel = 0;
      let processedInCurrentLevel = 0;
      let xOffset = 0;

      while (queue.length > 0) {
        const node = queue.shift()!;
        const level = levels.get(node.id)!;

        // Check if node is in message context
        const isInMessageContext = messageContext.some(
          (msg) => msg.id === node.id
        );

        // Add node
        newNodes.push({
          id: node.id,
          position: {
            x: level * 250,
            y: xOffset * 150,
          },
          data: {
            label: (
              <div className="max-w-[200px] whitespace-pre-wrap text-xs">
                <strong>Q: </strong>
                {node.query.substring(0, 50)}
                {node.query.length > 50 ? "..." : ""}
                <br />
                <strong>A: </strong>
                {node.response.substring(0, 50)}
                {node.response.length > 50 ? "..." : ""}
              </div>
            ),
          },
          style: {
            width: 220,
            padding: "10px",
            border: isInMessageContext ? "2px solid #ff0000" : undefined,
          },
        });

        // Add edges to children
        node.children.forEach((childId) => {
          const childNode = chatNodes.get(childId);
          if (childNode) {
            queue.push(childNode);
            levels.set(childId, level + 1);
            nodesInNextLevel++;

            newEdges.push({
              id: `edge-${node.id}-${childId}`,
              source: node.id,
              target: childId,
              type: "default",
              style: {
                stroke: isInMessageContext ? "#ff0000" : "#333",
                strokeWidth: 2,
              },
            });
          }
        });

        processedInCurrentLevel++;
        xOffset++;

        if (processedInCurrentLevel === nodesInCurrentLevel) {
          currentLevel++;
          nodesInCurrentLevel = nodesInNextLevel;
          nodesInNextLevel = 0;
          processedInCurrentLevel = 0;
        }
      }

      setNodes(newNodes);
      setEdges(newEdges);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [chatNodes]);

  // Separate effect for fitting view
  useEffect(() => {
    if (reactFlowInstance && nodes.length > 0) {
      debouncedFitView(reactFlowInstance);
    }
  }, [nodes, reactFlowInstance, debouncedFitView]);

  // Update currentChatIndex when new messages come in
  useEffect(() => {
    setCurrentChatIndex(Math.floor((messageContext.length - 1) / 2));
  }, [messageContext.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messageContext]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      if (isSmallScreen) {
        const headerHeight = 48; // Height of the header
        const containerHeight = window.innerHeight - headerHeight;
        const relativeY = e.clientY - headerHeight;
        const percentage = (relativeY / containerHeight) * 100;
        setSplitPosition(Math.min(Math.max(percentage, 20), 80)); // Limit between 20% and 80%
      } else {
        const sidebarWidth = isSidebarOpen ? 256 : 0;
        const availableWidth = window.innerWidth - sidebarWidth;
        const relativeX = e.clientX - sidebarWidth;
        const percentage = (relativeX / availableWidth) * 100;
        setSplitPosition(Math.min(Math.max(percentage, 20), 80));
      }
    },
    [isDragging, isSidebarOpen, isSmallScreen]
  );

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

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
    <div
      className={cn(
        "flex-1 flex flex-col h-[calc(100vh-48px)]",
        isSidebarOpen ? "ml-64" : ""
      )}
    >
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Chat Side */}
        <div
          style={{
            width: isSmallScreen ? "100%" : `${splitPosition}%`,
            height: isSmallScreen ? `${splitPosition}%` : "100%",
          }}
          className="flex flex-col"
        >
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-4">
              {messageContext.map((msg, idx) => (
                <div key={idx}>
                  <ChatMessage message={{ content: msg.query, isUser: true }} />
                  <ChatMessage
                    message={{ content: msg.response, isUser: false }}
                  />
                </div>
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
          className={cn(
            "bg-muted hover:bg-muted/100 active:bg-muted/60",
            isSmallScreen ? "h-1 cursor-row-resize" : "w-1 cursor-col-resize"
          )}
          onMouseDown={handleMouseDown}
        />

        <ChatGraph
          nodes={nodes}
          edges={edges}
          onInit={onInit}
          splitPosition={splitPosition}
          isSmallScreen={isSmallScreen}
        />
      </div>
    </div>
  );
}

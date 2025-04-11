import { cn } from "@/lib/utils";
import { ChatMessage } from "./ChatMessage";
import { Message } from "@/types/chat";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  GitBranch,
  MessageSquare,
  Command,
  CornerDownLeft,
  HelpCircle,
} from "lucide-react";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Controls, ReactFlowInstance } from "reactflow";
import ReactFlow from "reactflow";
import { Background, Node, Edge } from "reactflow";
import { ChatNode } from "@/types/chat";
import { ChatGraph } from "./ChatGraph";
import { Textarea } from "./ui/textarea";
import { debounce } from "lodash";
import { TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Tooltip } from "./ui/tooltip";
import { ChatMessageWithChildren } from "./ChatMessageWithChildren";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";

export type ModelType =
  | "llama-3.1-8b"
  | "llama-3.3-70b"
  | "llama-4-scout-17b-16e-instruct"
  | "deepseek-chat"
  | "deepseek-reasoner";

interface ModelConfig {
  name: string;
  pricing: {
    inputTokensCached: number;
    inputTokens: number;
    outputTokens: number;
  };
}

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cached: boolean;
}

interface ChatWindowProps {
  messageContext: string[];
  chatNodes: Map<string, ChatNode>;
  currentChatId: string;
  currentChatNode: ChatNode | null;
  isSidebarOpen: boolean;
  input: string;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onInputFocus: () => void;
  onInputBlur: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  isLoadingFirstToken: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  inInsertMode: boolean;
  onSelectNode: (nodeId: string) => void;
  onBranch: () => void;
  selectedModel: ModelType;
  onModelChange: (model: ModelType) => void;
  tokenUsage: Map<string, TokenUsage>;
  autoRouteEnabled: boolean;
  setAutoRouteEnabled: (enabled: boolean) => void;
}

export function ChatWindow({
  messageContext,
  chatNodes,
  currentChatId,
  currentChatNode,
  isSidebarOpen,
  input,
  onInputChange,
  onInputFocus,
  onInputBlur,
  onSubmit,
  isLoading,
  isLoadingFirstToken,
  inputRef,
  inInsertMode,
  onSelectNode,
  onBranch,
  selectedModel,
  onModelChange,
  tokenUsage,
  autoRouteEnabled,
  setAutoRouteEnabled,
}: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageWindowRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [currentChatIndex, setCurrentChatIndex] = useState<number>(0);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  const [splitPosition, setSplitPosition] = useState(50); // percentage
  const [isDragging, setIsDragging] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [complexityThreshold, setComplexityThreshold] = useState(0.2);

  // Model configurations with detailed pricing
  const modelConfigs: Record<ModelType, ModelConfig> = {
    "llama-3.1-8b": {
      name: "Llama 3.1 (8B)",
      pricing: {
        inputTokensCached: 0,
        inputTokens: 0,
        outputTokens: 0,
      },
    },
    "llama-3.3-70b": {
      name: "Llama 3.3 (70B)",
      pricing: {
        inputTokensCached: 0,
        inputTokens: 0,
        outputTokens: 0,
      },
    },
    "llama-4-scout-17b-16e-instruct": {
      name: "Llama 4 Scout (17B)",
      pricing: {
        inputTokensCached: 0,
        inputTokens: 0,
        outputTokens: 0,
      },
    },
    "deepseek-chat": {
      name: "DeepSeek Chat",
      pricing: {
        inputTokensCached: 0.014,
        inputTokens: 0.14,
        outputTokens: 0.28,
      },
    },
    "deepseek-reasoner": {
      name: "DeepSeek Reasoner",
      pricing: {
        inputTokensCached: 0.14,
        inputTokens: 0.55,
        outputTokens: 2.19,
      },
    },
  };

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
      const subtreeWidths: Map<string, number> = new Map();

      // Calculate subtree widths using post-order traversal
      const calculateSubtreeWidth = (nodeId: string): number => {
        const node = chatNodes.get(nodeId);
        if (!node) return 0;

        if (node.children.length === 0) {
          subtreeWidths.set(nodeId, 1);
          return 1;
        }

        let totalWidth = 0;
        node.children.forEach((childId) => {
          totalWidth += calculateSubtreeWidth(childId);
        });

        // Node should be at least as wide as its children
        const width = Math.max(1, totalWidth);
        subtreeWidths.set(nodeId, width);
        return width;
      };

      // Start with root node
      const rootNode = chatNodes.get(`${currentChatId}-0`);
      if (rootNode) {
        calculateSubtreeWidth(`${currentChatId}-0`);
        queue.push(rootNode);
        levels.set(`${currentChatId}-0`, 0);
      }

      // BFS traversal with level tracking
      const levelNodes: Map<number, ChatNode[]> = new Map();
      while (queue.length > 0) {
        const node = queue.shift()!;
        const level = levels.get(node.id)!;

        if (!levelNodes.has(level)) {
          levelNodes.set(level, []);
        }
        levelNodes.get(level)!.push(node);

        node.children.forEach((childId) => {
          const childNode = chatNodes.get(childId);
          if (childNode) {
            queue.push(childNode);
            levels.set(childId, level + 1);
          }
        });
      }

      // Position nodes level by level
      levelNodes.forEach((nodes, level) => {
        let xPos = 0;
        nodes.forEach((node) => {
          const subtreeWidth = subtreeWidths.get(node.id) || 1;
          const nodeSpacing = 200; // Base spacing between nodes

          const isInMessageContext = messageContext.some(
            (msg) => msg === node.id
          );

          newNodes.push({
            id: node.id,
            position: {
              x: xPos,
              y: level * 150, // Increased vertical spacing
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
              width: 150,
              padding: "10px",
              border: isInMessageContext ? "2px solid #ff0000" : undefined,
              backgroundColor:
                currentChatNode?.id === node.id ? "#ffffd0" : undefined,
            },
          });

          // Add edges to children
          node.children.forEach((childId) => {
            const childNode = chatNodes.get(childId);
            if (childNode) {
              newEdges.push({
                id: `edge-${node.id}-${childId}`,
                source: node.id,
                target: childId,
                type: "smoothstep",
                style: {
                  stroke:
                    isInMessageContext &&
                    messageContext.some((msg) => msg === childId)
                      ? "#ff0000"
                      : "hsl(var(--foreground))",
                  strokeWidth: 2,
                },
              });
            }
          });

          // Move x position by the width of the current subtree
          xPos += subtreeWidth * nodeSpacing;
        });
      });

      setNodes(newNodes);
      setEdges(newEdges);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [chatNodes, currentChatNode, inInsertMode, messageContext, currentChatId]);

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
    if (isLoadingFirstToken || messageContext.length === 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messageContext, isLoadingFirstToken]);

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

  // Add keyboard shortcuts for model selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow Command+Enter to submit in any mode
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (input.trim() && !isLoading) {
          onSubmit(e as unknown as React.FormEvent);
        }
        return;
      }

      // Only handle model selection shortcuts when not in insert mode
      if (inInsertMode) return;

      const modelKeys = Object.keys(modelConfigs) as ModelType[];
      const num = parseInt(e.key);

      if (!isNaN(num) && num >= 1 && num <= modelKeys.length) {
        const selectedModelKey = modelKeys[num - 1];
        onModelChange(selectedModelKey);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onModelChange, inInsertMode, input, isLoading, onSubmit]);

  // Calculate estimated cost for the next request
  const calculateEstimatedCost = (inputTokens: number) => {
    const pricing = modelConfigs[selectedModel].pricing;
    // Include both the new input tokens and the context tokens from previous messages
    const contextTokens = messageContext.reduce((total, nodeId) => {
      const usage = tokenUsage.get(nodeId);
      if (usage) {
        total += usage.inputTokens + usage.outputTokens;
      }
      return total;
    }, 0);

    // Calculate cost for both context and new input
    const totalInputTokens = contextTokens + inputTokens;
    return (totalInputTokens / 1_000_000) * pricing.inputTokens;
  };

  // Calculate total cost for a completed request
  const calculateActualCost = (usage: TokenUsage) => {
    const pricing = modelConfigs[selectedModel].pricing;
    return (
      (usage.inputTokens / 1_000_000) *
        (usage.cached ? pricing.inputTokensCached : pricing.inputTokens) +
      (usage.outputTokens / 1_000_000) * pricing.outputTokens
    );
  };

  // Calculate total usage and cost
  const getTotalUsageAndCost = () => {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCost = 0;

    messageContext.forEach((nodeId) => {
      const usage = tokenUsage.get(nodeId);
      if (usage) {
        totalInputTokens += usage.inputTokens;
        totalOutputTokens += usage.outputTokens;
        totalCost += calculateActualCost(usage);
      }
    });

    return { totalInputTokens, totalOutputTokens, totalCost };
  };

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
          <div ref={messageWindowRef} className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-4">
              {messageContext.map((nodeId, idx) => {
                const node = chatNodes.get(nodeId);
                if (!node) return null;

                return (
                  <ChatMessageWithChildren
                    key={nodeId}
                    nodeId={nodeId}
                    node={node}
                    chatNodes={chatNodes}
                    currentChatNode={currentChatNode}
                    inInsertMode={inInsertMode}
                    isLastNode={idx === messageContext.length - 1}
                    messageContext={messageContext}
                    onSelectNode={onSelectNode}
                    messageWindowRef={messageWindowRef}
                  />
                );
              })}
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
                ref={inputRef}
                value={input}
                onChange={onInputChange}
                onFocus={onInputFocus}
                onBlur={onInputBlur}
                placeholder="Type your message..."
                className="flex-1"
                rows={Math.min(input.split("\n").length, 12)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    onSubmit(e);
                  }
                }}
              />
              <div className="flex items-center justify-between">
                <div className="flex gap-4 items-center text-sm text-muted-foreground">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 mr-2">
                          <TooltipProvider>
                            <Tooltip delayDuration={0}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-4 w-4 p-0"
                                >
                                  <HelpCircle className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="max-w-[300px] space-y-2"
                              >
                                <p className="font-medium">Auto Router</p>
                                <p className="text-sm">
                                  Automatically selects the best model based on
                                  query complexity:
                                </p>
                                <ul className="text-sm list-disc pl-4">
                                  <li>Simple queries → Llama 3.1 (8B)</li>
                                  <li>Moderate complexity → Llama 3.3 (70B)</li>
                                  <li>Complex queries → DeepSeek Reasoner</li>
                                </ul>
                                <p className="text-sm">
                                  Moving the slider towards "Complex" will favor
                                  more powerful models.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <Label htmlFor="auto-route" className="text-sm">
                            Auto Router
                          </Label>
                        </div>
                        <Switch
                          id="auto-route"
                          checked={autoRouteEnabled}
                          onCheckedChange={setAutoRouteEnabled}
                        />
                      </div>
                    </div>
                    <div className="relative">
                      {autoRouteEnabled ? (
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs text-muted-foreground">
                            Complexity Threshold
                          </Label>
                          <div className="flex items-center gap-2">
                            <span className="text-xs">Simple</span>
                            <Slider
                              value={[complexityThreshold]}
                              onValueChange={([value]) => {
                                setComplexityThreshold(value);
                              }}
                              min={0}
                              max={1}
                              step={0.01}
                              className="w-32"
                            />
                            <span className="text-xs">Complex</span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8"
                            onClick={() => setModelMenuOpen(true)}
                          >
                            {modelConfigs[selectedModel].name}
                            <ChevronUp
                              className={cn(
                                "ml-2 h-4 w-4",
                                modelMenuOpen ? "rotate-180" : ""
                              )}
                            />
                          </Button>
                          {modelMenuOpen && (
                            <div
                              className="absolute bottom-full mb-1 w-64 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5"
                              onMouseLeave={() => setModelMenuOpen(false)}
                            >
                              <div className="py-1" role="menu">
                                {(Object.keys(modelConfigs) as ModelType[]).map(
                                  (model, index) => (
                                    <TooltipProvider
                                      key={model}
                                      delayDuration={0}
                                    >
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            className={cn(
                                              "block w-full px-4 py-2 text-sm text-left hover:bg-gray-100",
                                              selectedModel === model
                                                ? "bg-gray-50"
                                                : ""
                                            )}
                                            role="menuitem"
                                            onClick={() => {
                                              onModelChange(model);
                                              setModelMenuOpen(false);
                                            }}
                                          >
                                            {modelConfigs[model].name}
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent
                                          side="left"
                                          className="space-y-1"
                                        >
                                          <p className="font-medium">
                                            Press <kbd>{index + 1}</kbd> to
                                            select
                                          </p>
                                          <div className="border-t my-2"></div>
                                          <p className="font-medium">
                                            Pricing per 1M tokens:
                                          </p>
                                          <p>
                                            Input (cached): $
                                            {
                                              modelConfigs[model].pricing
                                                .inputTokensCached
                                            }
                                          </p>
                                          <p>
                                            Input: $
                                            {
                                              modelConfigs[model].pricing
                                                .inputTokens
                                            }
                                          </p>
                                          <p>
                                            Output: $
                                            {
                                              modelConfigs[model].pricing
                                                .outputTokens
                                            }
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col border-l pl-4">
                    <span className="font-medium">Tokens</span>
                    {(() => {
                      const { totalInputTokens, totalOutputTokens } =
                        getTotalUsageAndCost();
                      const estimatedInputTokens = Math.ceil(input.length / 4);
                      return (
                        <>
                          <span className="text-xs">
                            History: {totalInputTokens + totalOutputTokens} (
                            {totalInputTokens} in + {totalOutputTokens} out)
                          </span>
                          <span className="text-xs">
                            Next: ~{estimatedInputTokens} input tokens
                          </span>
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium">Cost</span>
                    {(() => {
                      const { totalCost } = getTotalUsageAndCost();
                      const estimatedInputTokens = Math.ceil(input.length / 4);
                      const estimatedNextCost =
                        calculateEstimatedCost(estimatedInputTokens);
                      return (
                        <>
                          <span className="text-xs">
                            Total: ${totalCost.toFixed(6)}
                          </span>
                          <span className="text-xs">
                            Est. Next: ${estimatedNextCost.toFixed(6)}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  {!inInsertMode && (
                    <TooltipProvider>
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onBranch}
                          >
                            <GitBranch className="h-4 w-4 relative" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            Press <kbd>b</kbd> to branch
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <Button type="submit" disabled={isLoading} size="sm">
                    {isLoading ? (
                      <div className="h-4 w-4 relative">
                        <div className="absolute inset-0 border-2 border-current rounded-sm" />
                        <div className="absolute inset-[30%] bg-current rounded-full" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Command className="h-3 w-3" />
                        <CornerDownLeft className="h-4 w-4" />
                      </div>
                    )}
                  </Button>
                </div>
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
          onNodeClick={onSelectNode}
        />
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";
import { ChatMessage } from "./ChatMessage";
import { Message } from "@/types/chat";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  ChevronUp,
  GitBranch,
  Command,
  CornerDownLeft,
  Braces,
  Paperclip,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Code2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { ReactFlowInstance } from "reactflow";
import ReactFlow from "reactflow";
import { Background, Node, Edge } from "reactflow";
import { ChatNode } from "@/types/chat";
import { RLMRun, RLMNode, RLMIteration, RLMEvent } from "@/types/rlm";
import { ChatGraph } from "./ChatGraph";
import { Textarea } from "./ui/textarea";
import { debounce } from "lodash";
import { TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Tooltip } from "./ui/tooltip";
import { ChatMessageWithChildren } from "./ChatMessageWithChildren";

export type ModelType =
  | "llama3.1-8b"
  | "gpt-oss-120b"
  | "qwen-3-235b-a22b-instruct-2507"
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
  onSubmit: (e: React.FormEvent, pdfText?: string, pdfName?: string) => void;
  isLoading: boolean;
  isLoadingFirstToken: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  inInsertMode: boolean;
  onSelectNode: (nodeId: string) => void;
  onBranch: () => void;
  selectedModel: ModelType;
  onModelChange: (model: ModelType) => void;
  tokenUsage: Map<string, TokenUsage>;
  rlmMode?: boolean;
  onToggleRlmMode?: () => void;
}

// ─── Small RLM display helpers ────────────────────────────────────────────────

function CodeBlock({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 rounded border border-border bg-muted/50">
      <button
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground w-full text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <Code2 className="h-3 w-3" />
        <span>Generated code</span>
        {open ? <ChevronDown className="h-3 w-3 ml-auto" /> : <ChevronRight className="h-3 w-3 ml-auto" />}
      </button>
      {open && (
        <pre className="px-3 pb-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
          {code}
        </pre>
      )}
    </div>
  );
}

function SubCallItem({ node }: { node: RLMNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-l-2 border-border pl-3 py-1">
      <button
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground w-full text-left"
        onClick={() => setOpen((v) => !v)}
      >
        {node.status === "running" ? (
          <Loader2 className="h-3 w-3 animate-spin text-blue-500 shrink-0" />
        ) : node.status === "complete" ? (
          <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
        ) : (
          <AlertCircle className="h-3 w-3 text-yellow-500 shrink-0" />
        )}
        <span className="truncate flex-1">{node.prompt}</span>
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
      </button>
      {open && node.response && (
        <p className="mt-1 text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap pl-4">
          {node.response}
        </p>
      )}
    </div>
  );
}

function IterationCard({ iter }: { iter: RLMIteration }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-md border border-border bg-muted/30">
      <button
        className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-violet-600 font-semibold">Iteration {iter.index + 1}</span>
        <span className="text-muted-foreground/50">·</span>
        <span>{iter.replBlocks.length} repl block{iter.replBlocks.length !== 1 ? "s" : ""}</span>
        <span className="ml-auto">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          {iter.response && (
            <div className="text-xs text-foreground/70 leading-relaxed whitespace-pre-wrap border-l-2 border-violet-300 pl-2">
              {iter.response.length > 600
                ? iter.response.slice(0, 600) + "…"
                : iter.response}
            </div>
          )}
          {iter.replBlocks.map((block, i) => (
            <div key={i} className="rounded border border-border bg-background">
              <CodeBlock code={block.code} />
              {block.output && (
                <pre className="px-3 pb-2 text-xs font-mono text-green-700 dark:text-green-400 whitespace-pre-wrap overflow-x-auto border-t border-border">
                  {block.output.length > 400 ? block.output.slice(0, 400) + "…" : block.output}
                </pre>
              )}
            </div>
          ))}
          {iter.activeCode && (
            <div className="rounded border border-blue-200 bg-blue-50 dark:bg-blue-900/20">
              <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Executing…</span>
              </div>
              <pre className="px-3 pb-2 text-xs font-mono whitespace-pre-wrap overflow-x-auto">
                {iter.activeCode}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RLMRunCard({ run }: { run: RLMRun }) {
  const subCallList = Array.from(run.subCalls.values());
  const totalIter = run.iterations.length;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-start gap-2">
        <div className="h-6 w-6 rounded-full bg-foreground flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-background text-xs font-bold">U</span>
        </div>
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          {run.pdfName && (
            <div className="flex items-center gap-1.5 self-start rounded-md border border-violet-200 bg-violet-50 dark:bg-violet-900/20 dark:border-violet-800 px-2 py-1 text-xs text-violet-700 dark:text-violet-300">
              <Paperclip className="h-3 w-3 shrink-0" />
              <span className="truncate max-w-[200px]">{run.pdfName}</span>
            </div>
          )}
          <p className="text-sm font-medium">{run.prompt}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {run.status === "running" ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
            <span>Executing… iteration {totalIter}</span>
          </>
        ) : run.status === "complete" ? (
          <>
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            <span>
              {totalIter} iteration{totalIter !== 1 ? "s" : ""} · {subCallList.length} sub-call
              {subCallList.length !== 1 ? "s" : ""}
            </span>
          </>
        ) : run.status === "error" ? (
          <>
            <AlertCircle className="h-3 w-3 text-red-500" />
            <span>Error</span>
          </>
        ) : (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Starting…</span>
          </>
        )}
      </div>

      {run.iterations.length > 0 && (
        <div className="space-y-2">
          {run.iterations.map((iter) => (
            <IterationCard key={iter.index} iter={iter} />
          ))}
        </div>
      )}

      {subCallList.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Sub-calls (llm_query):</p>
          {subCallList.map((n) => (
            <SubCallItem key={n.id} node={n} />
          ))}
        </div>
      )}

      {run.finalAnswer && (
        <div className="rounded-md bg-muted/60 p-3">
          <p className="text-xs text-muted-foreground font-medium mb-1">Final Answer</p>
          <p className="text-sm whitespace-pre-wrap">{run.finalAnswer}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

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
  rlmMode,
  onToggleRlmMode,
}: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageWindowRef = useRef<HTMLDivElement>(null);
  const rlmScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [currentChatIndex, setCurrentChatIndex] = useState<number>(0);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [splitPosition, setSplitPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  // RLM state
  const [rlmRuns, setRlmRuns] = useState<RLMRun[]>([]);
  const [rlmInput, setRlmInput] = useState("");
  const [rlmIsLoading, setRlmIsLoading] = useState(false);

  interface PdfAttachment { id: string; file: File; text: string; loading: boolean; }
  const [pdfAttachments, setPdfAttachments] = useState<PdfAttachment[]>([]);
  const pdfLoading = pdfAttachments.some((a) => a.loading);
  const combinedPdfText = pdfAttachments.filter((a) => a.text).map((a) => `[PDF: ${a.file.name}]\n${a.text}`).join("\n\n---\n\n");
  const combinedPdfName = pdfAttachments.map((a) => a.file.name).join(", ");

  const modelConfigs: Record<ModelType, ModelConfig> = {
    "llama3.1-8b": { name: "Llama 3.1 8B", pricing: { inputTokensCached: 0, inputTokens: 0.10, outputTokens: 0.10 } },
    "gpt-oss-120b": { name: "GPT OSS 120B", pricing: { inputTokensCached: 0, inputTokens: 0.35, outputTokens: 0.75 } },
    "qwen-3-235b-a22b-instruct-2507": { name: "Qwen 3 235B", pricing: { inputTokensCached: 0, inputTokens: 0.60, outputTokens: 1.20 } },
    "deepseek-chat": { name: "DeepSeek V3", pricing: { inputTokensCached: 0.028, inputTokens: 0.28, outputTokens: 0.42 } },
    "deepseek-reasoner": { name: "DeepSeek Reasoner", pricing: { inputTokensCached: 0.028, inputTokens: 0.28, outputTokens: 0.42 } },
  };

  useEffect(() => {
    const check = () => setIsSmallScreen(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    setReactFlowInstance(instance);
    instance.fitView({ padding: 0.2 });
  }, []);

  const debouncedFitView = useMemo(
    () => debounce((instance: ReactFlowInstance) => {
      requestAnimationFrame(() => { instance?.fitView({ padding: 0.2, duration: 200 }); });
    }, 250),
    []
  );

  // Chat graph nodes/edges
  useEffect(() => {
    if (rlmMode) return;
    const timeoutId = setTimeout(() => {
      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];
      const queue: ChatNode[] = [];
      const levels: Map<string, number> = new Map();
      const subtreeWidths: Map<string, number> = new Map();

      const calculateSubtreeWidth = (nodeId: string): number => {
        const node = chatNodes.get(nodeId);
        if (!node) return 0;
        if (node.children.length === 0) { subtreeWidths.set(nodeId, 1); return 1; }
        let totalWidth = 0;
        node.children.forEach((childId) => { totalWidth += calculateSubtreeWidth(childId); });
        const width = Math.max(1, totalWidth);
        subtreeWidths.set(nodeId, width);
        return width;
      };

      const rootNode = chatNodes.get(`${currentChatId}-0`);
      if (rootNode) {
        calculateSubtreeWidth(`${currentChatId}-0`);
        queue.push(rootNode);
        levels.set(`${currentChatId}-0`, 0);
      }

      const levelNodes: Map<number, ChatNode[]> = new Map();
      while (queue.length > 0) {
        const node = queue.shift()!;
        const level = levels.get(node.id)!;
        if (!levelNodes.has(level)) levelNodes.set(level, []);
        levelNodes.get(level)!.push(node);
        node.children.forEach((childId) => {
          const childNode = chatNodes.get(childId);
          if (childNode) { queue.push(childNode); levels.set(childId, level + 1); }
        });
      }

      levelNodes.forEach((nodesAtLevel, level) => {
        let xPos = 0;
        nodesAtLevel.forEach((node) => {
          const subtreeWidth = subtreeWidths.get(node.id) || 1;
          const nodeSpacing = 200;
          const isInMessageContext = messageContext.some((msg) => msg === node.id);
          newNodes.push({
            id: node.id,
            position: { x: xPos, y: level * 150 },
            data: {
              label: (
                <div className="max-w-[200px] whitespace-pre-wrap text-xs">
                  <strong>Q: </strong>{node.query.substring(0, 50)}{node.query.length > 50 ? "..." : ""}
                  <br />
                  <strong>A: </strong>{node.response.substring(0, 50)}{node.response.length > 50 ? "..." : ""}
                </div>
              ),
            },
            style: {
              width: 150,
              padding: "10px",
              border: isInMessageContext ? "2px solid #ff0000" : undefined,
              backgroundColor: currentChatNode?.id === node.id ? "#ffffd0" : undefined,
            },
          });
          node.children.forEach((childId) => {
            const childNode = chatNodes.get(childId);
            if (childNode) {
              newEdges.push({
                id: `edge-${node.id}-${childId}`,
                source: node.id,
                target: childId,
                type: "smoothstep",
                style: {
                  stroke: isInMessageContext && messageContext.some((msg) => msg === childId)
                    ? "#ff0000" : "hsl(var(--foreground))",
                  strokeWidth: 2,
                },
              });
            }
          });
          xPos += subtreeWidth * nodeSpacing;
        });
      });

      setNodes(newNodes);
      setEdges(newEdges);
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [chatNodes, currentChatNode, inInsertMode, messageContext, currentChatId, rlmMode]);

  // RLM graph: root node + flat sub-calls (depth=1, faithful to paper)
  const { rlmNodes, rlmEdges } = useMemo(() => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    const NODE_W = 170;
    const NODE_W_GAP = 200;

    let runYOffset = 0;

    rlmRuns.forEach((run) => {
      const subCallList = Array.from(run.subCalls.values());

      // Root node
      newNodes.push({
        id: `${run.id}-root`,
        position: { x: 0, y: runYOffset },
        data: {
          label: (
            <div className="max-w-[160px] text-xs">
              <div className="font-semibold text-violet-600 mb-0.5">
                RLM · {run.iterations.length} iter
              </div>
              <div className="truncate">
                {run.prompt.substring(0, 60)}{run.prompt.length > 60 ? "…" : ""}
              </div>
            </div>
          ),
        },
        style: {
          width: NODE_W,
          padding: "8px",
          borderRadius: "8px",
          border: run.status === "complete"
            ? "2px solid #8b5cf6"
            : "2px solid #3b82f6",
        },
      });

      // Sub-call nodes (flat, all children of root)
      const totalW = subCallList.length * NODE_W_GAP;
      subCallList.forEach((sn, i) => {
        const x = i * NODE_W_GAP - totalW / 2 + NODE_W_GAP / 2;
        newNodes.push({
          id: `${run.id}-${sn.id}`,
          position: { x, y: runYOffset + 160 },
          data: {
            label: (
              <div className="max-w-[150px] text-xs">
                <div className="truncate font-medium">
                  {sn.prompt.substring(0, 50)}{sn.prompt.length > 50 ? "…" : ""}
                </div>
                {sn.response && (
                  <div className="truncate text-muted-foreground mt-0.5">
                    {sn.response.substring(0, 40)}{sn.response.length > 40 ? "…" : ""}
                  </div>
                )}
              </div>
            ),
          },
          style: {
            width: NODE_W,
            padding: "8px",
            borderRadius: "6px",
            border: sn.status === "complete"
              ? "1.5px solid #22c55e"
              : sn.status === "running"
              ? "1.5px solid #3b82f6"
              : "1.5px solid #e5e7eb",
          },
        });
        newEdges.push({
          id: `edge-${run.id}-root-${sn.id}`,
          source: `${run.id}-root`,
          target: `${run.id}-${sn.id}`,
          type: "smoothstep",
          style: { stroke: "#94a3b8", strokeWidth: 1.5 },
        });
      });

      runYOffset += (subCallList.length > 0 ? 320 : 160) + 60;
    });

    return { rlmNodes: newNodes, rlmEdges: newEdges };
  }, [rlmRuns]);

  useEffect(() => {
    if (reactFlowInstance) debouncedFitView(reactFlowInstance);
  }, [nodes, rlmNodes, reactFlowInstance, debouncedFitView]);

  useEffect(() => {
    setCurrentChatIndex(Math.floor((messageContext.length - 1) / 2));
  }, [messageContext.length]);

  const scrollToBottom = () => {
    if (isLoadingFirstToken || messageContext.length === 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };
  useEffect(() => { scrollToBottom(); }, [messageContext, isLoadingFirstToken]);

  useEffect(() => {
    if (rlmRuns.length > 0) {
      rlmScrollRef.current?.scrollTo({ top: rlmScrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [rlmRuns]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    if (isSmallScreen) {
      const headerHeight = 48;
      const pct = ((e.clientY - headerHeight) / (window.innerHeight - headerHeight)) * 100;
      setSplitPosition(Math.min(Math.max(pct, 20), 80));
    } else {
      const sidebarWidth = isSidebarOpen ? 256 : 0;
      const pct = ((e.clientX - sidebarWidth) / (window.innerWidth - sidebarWidth)) * 100;
      setSplitPosition(Math.min(Math.max(pct, 20), 80));
    }
  }, [isDragging, isSidebarOpen, isSmallScreen]);

  const handleMouseDown = useCallback(() => setIsDragging(true), []);
  const handleMouseUp = useCallback(() => setIsDragging(false), []);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (rlmMode) {
          if (rlmInput.trim() && !rlmIsLoading) handleRlmSubmit();
        } else {
          if (input.trim() && !isLoading) {
            const ctx = combinedPdfText || undefined;
            const name = combinedPdfName || undefined;
            setPdfAttachments([]);
            onSubmit(e as unknown as React.FormEvent, ctx, name);
          }
        }
        return;
      }
      if (inInsertMode) return;
      const modelKeys: ModelType[] = ["llama3.1-8b", "gpt-oss-120b", "qwen-3-235b-a22b-instruct-2507", "deepseek-chat", "deepseek-reasoner"];
      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 1 && num <= modelKeys.length) onModelChange(modelKeys[num - 1]);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onModelChange, inInsertMode, input, isLoading, onSubmit, rlmMode, rlmInput, rlmIsLoading, combinedPdfText, combinedPdfName]);

  // ─── RLM logic ──────────────────────────────────────────────────────────────

  const handlePdfSelect = async (file: File) => {
    const id = crypto.randomUUID();
    setPdfAttachments((prev) => [...prev, { id, file, text: "", loading: true }]);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/pdf-extract", { method: "POST", body: fd });
      const { text, error } = await res.json();
      if (error) throw new Error(error);
      setPdfAttachments((prev) => prev.map((a) => a.id === id ? { ...a, text, loading: false } : a));
    } catch {
      setPdfAttachments((prev) => prev.map((a) => a.id === id ? { ...a, loading: false } : a));
    }
  };

  const applyRlmEvent = (runId: string, event: RLMEvent) => {
    setRlmRuns((prev) => prev.map((run) => {
      if (run.id !== runId) return run;

      switch (event.type) {
        case "iteration_start": {
          const newIter: RLMIteration = { index: event.iteration, response: "", replBlocks: [] };
          return { ...run, iterations: [...run.iterations, newIter], status: "running" as const };
        }
        case "llm_response": {
          const iterations = run.iterations.map((it) =>
            it.index === event.iteration ? { ...it, response: event.text } : it
          );
          return { ...run, iterations };
        }
        case "repl_exec": {
          // Mark the current iteration as having an active (executing) block
          const iterations = run.iterations.map((it) =>
            it.index === event.iteration ? { ...it, activeCode: event.code } : it
          );
          return { ...run, iterations };
        }
        case "repl_output": {
          const iterations = run.iterations.map((it) => {
            if (it.index !== event.iteration) return it;
            const replBlocks = [...it.replBlocks, { code: event.code, output: event.output }];
            return { ...it, replBlocks, activeCode: undefined };
          });
          return { ...run, iterations };
        }
        case "node_start": {
          const subCalls = new Map(run.subCalls);
          subCalls.set(event.nodeId, {
            id: event.nodeId,
            parentId: event.parentId,
            prompt: event.prompt,
            status: "running",
            depth: event.depth,
          });
          return { ...run, subCalls };
        }
        case "node_complete": {
          const subCalls = new Map(run.subCalls);
          const n = subCalls.get(event.nodeId);
          if (n) subCalls.set(event.nodeId, { ...n, response: event.response, status: "complete" });
          return { ...run, subCalls };
        }
        case "session_end":
          return { ...run, status: "complete" as const, finalAnswer: event.response || undefined };
        case "error":
          return { ...run, status: "error" as const };
        default:
          return run;
      }
    }));
  };

  const handleRlmSubmit = async () => {
    if (!rlmInput.trim() || rlmIsLoading) return;
    const runId = crypto.randomUUID();
    const prompt = rlmInput.trim();
    const submittedPdfName = combinedPdfName || undefined;
    const submittedPdfText = combinedPdfText;
    setRlmInput("");
    setPdfAttachments([]);
    setRlmIsLoading(true);

    setRlmRuns((prev) => [...prev, {
      id: runId,
      prompt,
      contextText: submittedPdfText || undefined,
      pdfName: submittedPdfName,
      iterations: [],
      subCalls: new Map(),
      rootNodeId: "root",
      status: "pending" as const,
      createdAt: new Date(),
    }]);

    try {
      const res = await fetch("/api/rlm-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model: selectedModel, contextText: submittedPdfText || undefined }),
      });
      if (!res.ok) throw new Error(res.statusText);
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No reader");
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n").filter(Boolean)) {
          try { applyRlmEvent(runId, JSON.parse(line) as RLMEvent); } catch {}
        }
      }
    } catch {
      setRlmRuns((prev) => prev.map((r) => r.id === runId ? { ...r, status: "error" as const } : r));
    } finally {
      setRlmIsLoading(false);
    }
  };

  // ─── Cost helpers ────────────────────────────────────────────────────────────

  const calculateActualCost = (usage: TokenUsage) => {
    const p = modelConfigs[selectedModel].pricing;
    return (usage.inputTokens / 1_000_000) * (usage.cached ? p.inputTokensCached : p.inputTokens)
      + (usage.outputTokens / 1_000_000) * p.outputTokens;
  };

  const getTotalUsageAndCost = () => {
    let totalInputTokens = 0, totalOutputTokens = 0, totalCost = 0;
    messageContext.forEach((nodeId) => {
      const usage = tokenUsage.get(nodeId);
      if (usage) { totalInputTokens += usage.inputTokens; totalOutputTokens += usage.outputTokens; totalCost += calculateActualCost(usage); }
    });
    return { totalInputTokens, totalOutputTokens, totalCost };
  };

  // ─── Derived values ──────────────────────────────────────────────────────────

  const activeInput = rlmMode ? rlmInput : input;
  const activeIsLoading = rlmMode ? rlmIsLoading : isLoading;
  const showRlmToggle = onToggleRlmMode && (messageContext.length === 0 || rlmMode);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={cn("flex-1 flex flex-col h-[calc(100vh-48px)]", isSidebarOpen ? "ml-64" : "")}>
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* ── Left pane ── */}
        <div
          style={{ width: isSmallScreen ? "100%" : `${splitPosition}%`, height: isSmallScreen ? `${splitPosition}%` : "100%" }}
          className="flex flex-col min-w-0 overflow-hidden"
        >
          {rlmMode ? (
            /* RLM run list */
            <div ref={rlmScrollRef} className="flex-1 p-4 overflow-y-auto space-y-4">
              {rlmRuns.map((run) => <RLMRunCard key={run.id} run={run} />)}
            </div>
          ) : (
            /* Normal chat messages */
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
          )}

          {/* ── Bottom bar — identical structure in both modes ── */}
          <div className="border-t">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (rlmMode) {
                  handleRlmSubmit();
                } else {
                  const ctx = combinedPdfText || undefined;
                  const name = combinedPdfName || undefined;
                  setPdfAttachments([]);
                  onSubmit(e, ctx, name);
                }
              }}
              className="p-4 flex flex-col gap-3"
            >
              {pdfAttachments.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 px-1">
                  {pdfAttachments.map((att) => (
                    <div key={att.id} className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-2 py-1.5 text-xs">
                      <Paperclip className="h-3.5 w-3.5 text-violet-600 shrink-0" />
                      <span className="text-muted-foreground truncate max-w-[200px]">{att.file.name}</span>
                      {att.loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />}
                      {!att.loading && (
                        <span className="text-muted-foreground/60 shrink-0">
                          {(att.text.length / 1000).toFixed(0)}k chars
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setPdfAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                        className="shrink-0 text-muted-foreground hover:text-foreground ml-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePdfSelect(f); e.target.value = ""; }}
                />
                <TooltipProvider>
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                          "shrink-0 flex items-center text-muted-foreground hover:text-foreground",
                          pdfAttachments.length > 0 && "text-violet-600 hover:text-violet-700"
                        )}
                      >
                        <Paperclip className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Attach PDF as context</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Textarea
                  ref={inputRef}
                  value={activeInput}
                  onChange={rlmMode ? (e) => setRlmInput(e.target.value) : onInputChange}
                  onFocus={onInputFocus}
                  onBlur={onInputBlur}
                  placeholder={rlmMode ? "Describe your research task…" : "Type your message…"}
                  className="flex-1"
                  rows={Math.min(activeInput.split("\n").length, 12)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      // Handled by the global window keydown listener
                    }
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                {/* Left: model + token info (or PDF when in RLM mode) */}
                <div className="flex gap-4 items-center text-sm text-muted-foreground">
                  <div className="relative">
                    <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => setModelMenuOpen(true)}>
                      {modelConfigs[selectedModel].name}
                      <ChevronUp className={cn("ml-2 h-4 w-4", modelMenuOpen ? "rotate-180" : "")} />
                    </Button>
                    {modelMenuOpen && (
                      <div className="absolute bottom-full mb-1 w-64 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5" onMouseLeave={() => setModelMenuOpen(false)}>
                        <div className="py-1" role="menu">
                          {(Object.keys(modelConfigs) as ModelType[]).map((model, index) => (
                            <TooltipProvider key={model} delayDuration={0}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    className={cn("block w-full px-4 py-2 text-sm text-left hover:bg-gray-100", selectedModel === model ? "bg-gray-50" : "")}
                                    role="menuitem"
                                    onClick={() => { onModelChange(model); setModelMenuOpen(false); }}
                                  >
                                    {modelConfigs[model].name}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="space-y-1">
                                  <p className="font-medium">Press <kbd>{index + 1}</kbd> to select</p>
                                  <div className="border-t my-2" />
                                  <p className="font-medium">Pricing per 1M tokens:</p>
                                  {modelConfigs[model].pricing.inputTokensCached > 0 && <p>Input (cached): ${modelConfigs[model].pricing.inputTokensCached}</p>}
                                  <p>Input: ${modelConfigs[model].pricing.inputTokens}</p>
                                  <p>Output: ${modelConfigs[model].pricing.outputTokens}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col border-l pl-4">
                    <span className="font-medium">Tokens</span>
                    {(() => {
                      const { totalInputTokens, totalOutputTokens } = getTotalUsageAndCost();
                      const estimatedInputTokens = Math.ceil(input.length / 4);
                      return (
                        <>
                          <span className="text-xs">History: {totalInputTokens + totalOutputTokens} ({totalInputTokens} in + {totalOutputTokens} out)</span>
                          <span className="text-xs">Next: ~{estimatedInputTokens} input tokens</span>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Right: RLM toggle + branch + submit */}
                <div className="flex gap-2 items-center">
                  {showRlmToggle && (
                    <TooltipProvider>
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (!rlmMode) {
                                // entering RLM: carry normal input over
                                setRlmInput(input);
                              } else {
                                // leaving RLM: carry rlmInput back to normal input
                                onInputChange({ target: { value: rlmInput } } as React.ChangeEvent<HTMLTextAreaElement>);
                              }
                              onToggleRlmMode?.();
                            }}
                            className={cn(
                              "h-8 gap-1.5 text-xs font-medium",
                              rlmMode
                                ? "bg-violet-100 text-violet-700 border-violet-300 hover:bg-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-700"
                                : "text-muted-foreground"
                            )}
                          >
                            <Braces className="h-3.5 w-3.5" />
                            RLM
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{rlmMode ? "Exit RLM mode" : "Recursive Language Model mode"}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <TooltipProvider>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={onBranch}
                          disabled={messageContext.length === 0 || !!rlmMode}
                        >
                          <GitBranch className="h-4 w-4 relative" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {messageContext.length === 0
                            ? "Send a message first to branch"
                            : "Press b to branch"}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Button type="submit" disabled={activeIsLoading || pdfLoading} size="sm">
                    {activeIsLoading ? (
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

        {/* ── Resizer ── */}
        <div
          className={cn("bg-muted hover:bg-muted/100 active:bg-muted/60", isSmallScreen ? "h-1 cursor-row-resize" : "w-1 cursor-col-resize")}
          onMouseDown={handleMouseDown}
        />

        {/* ── Right pane: graph (chat or RLM) ── */}
        <ChatGraph
          nodes={rlmMode ? rlmNodes : nodes}
          edges={rlmMode ? rlmEdges : edges}
          onInit={onInit}
          splitPosition={splitPosition}
          isSmallScreen={isSmallScreen}
          onNodeClick={rlmMode ? undefined : onSelectNode}
        />
      </div>
    </div>
  );
}

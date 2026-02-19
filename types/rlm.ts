export type RLMNodeStatus = "pending" | "running" | "complete" | "error";

/** A single llm_query() sub-call — always depth=1, direct answer */
export type RLMNode = {
  id: string;
  parentId: string | null;
  prompt: string;
  response?: string;
  status: RLMNodeStatus;
  depth: number;
};

/** One iteration of the root LM's multi-turn REPL loop */
export type RLMIteration = {
  index: number;
  response: string;
  replBlocks: Array<{ code: string; output: string }>;
  activeCode?: string; // code block being executed (output not yet arrived)
};

export type RLMRun = {
  id: string;
  prompt: string;
  contextText?: string;
  pdfName?: string;
  iterations: RLMIteration[];
  subCalls: Map<string, RLMNode>;
  status: "pending" | "running" | "complete" | "error";
  finalAnswer?: string;
  createdAt: Date;
};

export type RLMEvent =
  | { type: "status"; message: string }
  | { type: "iteration_start"; iteration: number }
  | { type: "llm_response"; iteration: number; text: string }
  | { type: "repl_exec"; iteration: number; code: string }
  | { type: "repl_output"; iteration: number; code: string; output: string }
  | { type: "node_start"; nodeId: string; parentId: string; depth: number; prompt: string }
  | { type: "node_complete"; nodeId: string; response: string }
  | { type: "session_end"; nodeId: string; parentId: null; response: string }
  | { type: "error"; error: string };

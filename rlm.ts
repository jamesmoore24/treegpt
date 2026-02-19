export type RLMNodeStatus = "pending" | "running" | "complete" | "error";

export type RLMNode = {
  id: string;
  parentId: string | null;
  prompt: string;
  code?: string; // only for root node
  response?: string;
  status: RLMNodeStatus;
  depth: number;
  children: string[];
};

export type RLMRun = {
  id: string;
  prompt: string;
  contextText?: string;
  nodes: Map<string, RLMNode>;
  rootNodeId: string;
  status: "pending" | "running" | "complete" | "error";
  finalAnswer?: string;
  createdAt: Date;
};

export type RLMEvent =
  | { type: "status"; message: string }
  | { type: "root_code"; nodeId: string; parentId: null; prompt: string; code: string }
  | { type: "node_start"; nodeId: string; parentId: string; prompt: string }
  | { type: "node_complete"; nodeId: string; response: string }
  | { type: "session_end"; nodeId: string; parentId: null; response: string }
  | { type: "error"; error: string };

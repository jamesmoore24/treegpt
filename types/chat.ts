export type Message = {
  content: string;
  isUser: boolean;
  model?: string;
};

export type ChatHistory = {
  id: string;
  title: string;
  timestamp: Date;
  messageContext: string[];
  chatNodes: Map<string, ChatNode>;
};

export type ChatNode = {
  id: string;
  parentId: string | null;
  children: string[];
  query: string;
  response: string;
  model?: string;
  pdfName?: string;
};

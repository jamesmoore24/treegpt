export type Message = {
  content: string;
  isUser: boolean;
};

export type ChatHistory = {
  id: string;
  title: string;
  timestamp: Date;
  messageContext: ChatNode[];
  chatNodes: Map<string, ChatNode>;
};

export type ChatNode = {
  id: string;
  parentId: string | null;
  children: string[];
  query: string;
  response: string;
};

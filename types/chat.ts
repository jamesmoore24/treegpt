export type Message = {
  content: string;
  isUser: boolean;
  modelInfo?: {
    name: string;
    percentage: number;
  };
};

export type SplitMessage = {
  left: Message[];
  right: Message[];
};

export type ChatHistory = {
  id: string;
  title: string;
  timestamp: Date;
  messages: SplitMessage;
};
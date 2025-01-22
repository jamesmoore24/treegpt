export type Message = {
  content: string;
  isUser: boolean;
  modelInfo?: {
    name: string;
    percentage: number;
  };
};

export type ChatHistory = {
  id: string;
  title: string;
  timestamp: Date;
  messages: Message[];
};

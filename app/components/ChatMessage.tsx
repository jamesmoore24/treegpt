"use client";

import { cn } from "@/lib/utils";
import { Message } from "@/types/chat";

interface ChatMessageProps {
  message: Message;
  showModelInfo?: boolean;
}

export function ChatMessage({
  message,
  showModelInfo = false,
}: ChatMessageProps) {
  return (
    <div
      className={cn("flex", message.isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-lg p-3",
          message.isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        <p>{message.content}</p>
        {message.modelInfo && showModelInfo && (
          <div className="mt-2 text-sm text-muted-foreground">
            <p>Model: {message.modelInfo.name}</p>
            <p>Population agreement: {message.modelInfo.percentage}%</p>
          </div>
        )}
      </div>
    </div>
  );
}

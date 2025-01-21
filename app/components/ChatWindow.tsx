import { cn } from "@/lib/utils";
import { ChatMessage } from "./ChatMessage";
import { Message } from "@/types/chat";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { MessageSquare } from "lucide-react";
import { useEffect, useRef } from "react";

interface ChatWindowProps {
  messages: {
    left: Message[];
    right: Message[];
  };
  hoveredSide: "left" | "right" | null;
  selectedSide: "left" | "right" | null;
  responsesReady: boolean;
  isSidebarOpen: boolean;
  input: string;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onHover: (side: "left" | "right" | null) => void;
  onClick: (side: "left" | "right") => void;
  isLoading: boolean;
}

export function ChatWindow({
  messages,
  hoveredSide,
  selectedSide,
  responsesReady,
  isSidebarOpen,
  input,
  onInputChange,
  onSubmit,
  onHover,
  onClick,
  isLoading,
}: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col  h-[calc(100vh-48px)]">
      <div
        className={cn("flex-1 flex overflow-hidden", isSidebarOpen && "ml-64")}
      >
        {/* Left Side */}
        <div className="flex-1 flex flex-col h-full">
          <div
            className={cn(
              "flex-1 p-4 overflow-y-auto",
              responsesReady && !selectedSide && "cursor-pointer"
            )}
            onClick={() => responsesReady && onClick("left")}
          >
            <div className="space-y-4">
              {messages.left.map((msg, idx) => (
                <ChatMessage
                  key={idx}
                  message={msg}
                  showModelInfo={!!selectedSide}
                />
              ))}
              {isLoading && (
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
          <form onSubmit={onSubmit} className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={onInputChange}
                placeholder="Type your message..."
                className="flex-1"
                disabled={isLoading}
              />
              <Button type="submit" disabled={isLoading}>
                <MessageSquare className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>

        {/* Right Side */}
        <div className="flex-1 border-l">TO DO: Tree map</div>
      </div>
    </div>
  );
}

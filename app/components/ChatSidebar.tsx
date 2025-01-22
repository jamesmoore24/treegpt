"use client";

import { Button } from "@/app/components/ui/button";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { Menu, Plus, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatHistory } from "@/types/chat";

interface ChatSidebarProps {
  isOpen: boolean;
  onToggleSidebar: () => void;
  onNewChat: () => void;
  history: ChatHistory[];
  onSelectChat: (id: string) => void;
  currentChatId: string | null;
}

export function ChatSidebar({
  isOpen,
  onToggleSidebar,
  onNewChat,
  history,
  onSelectChat,
  currentChatId,
}: ChatSidebarProps) {
  return (
    <div
      className={cn(
        "fixed left-0 top-0 h-full bg-card border-r z-10",
        isOpen ? "w-64" : "w-0"
      )}
    >
      {isOpen && (
        <div className="h-full flex flex-col">
          <div className="h-12 gap-2 flex items-center px-4">
            <Button variant="ghost" size="icon" onClick={onToggleSidebar}>
              <Menu className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onNewChat}>
              <Plus className="h-5 w-5" />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {history.map((chat) => (
                <Button
                  key={chat.id}
                  variant={currentChatId === chat.id ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => onSelectChat(chat.id)}
                >
                  <div className="w-6 flex justify-center pr-2">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <span className="truncate">{chat.title}</span>
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

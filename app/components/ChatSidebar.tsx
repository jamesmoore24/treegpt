"use client";

import { Button } from "@/app/components/ui/button";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { Menu, Plus, MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatHistory } from "@/types/chat";

interface ChatSidebarProps {
  isOpen: boolean;
  onToggleSidebar: () => void;
  onNewChat: () => void;
  history: ChatHistory[];
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  currentChatId: string | null;
}

export function ChatSidebar({
  isOpen,
  onToggleSidebar,
  onNewChat,
  history,
  onSelectChat,
  onDeleteChat,
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
            <div className="p-2 space-y-1">
              {history.map((chat) => (
                <div
                  key={chat.id}
                  className={cn(
                    "group flex items-center rounded-md",
                    currentChatId === chat.id ? "bg-secondary" : "hover:bg-accent"
                  )}
                >
                  <button
                    className="flex-1 flex items-center gap-2 px-3 py-2 text-sm text-left min-w-0"
                    onClick={() => onSelectChat(chat.id)}
                  >
                    <MessageSquare className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{chat.title}</span>
                  </button>
                  <button
                    className="shrink-0 p-1.5 mr-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-opacity"
                    onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id); }}
                    aria-label="Delete chat"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

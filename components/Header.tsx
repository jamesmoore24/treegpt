"use client";

import { Menu, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LivesCounter } from "@/components/LivesCounter";

interface HeaderProps {
  onToggleSidebar: () => void;
  onNewChat: () => void;
  queriesLeft: number;
}

export function Header({
  onToggleSidebar,
  onNewChat,
  queriesLeft,
}: HeaderProps) {
  return (
    <div className="h-12 border-b flex items-center px-4 justify-between">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onToggleSidebar}>
          <Menu className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onNewChat}>
          <Plus className="h-5 w-5" />
        </Button>
      </div>
      <LivesCounter queriesLeft={queriesLeft} />
    </div>
  );
}

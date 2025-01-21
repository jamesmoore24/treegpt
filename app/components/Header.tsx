"use client";

import { Menu, Plus } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { LivesCounter } from "@/app/components/LivesCounter";
import { cn } from "@/lib/utils";
import treeGPTLogo from "@/public/treeGPTLogo.png";
import Image from "next/image";

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
    <div className="h-12 border-b flex items-center px-4 justify-between relative">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onToggleSidebar}>
          <Menu className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onNewChat}>
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      <Image src={treeGPTLogo} alt="treeGPT Logo" width={150} height={150} />
      <LivesCounter queriesLeft={queriesLeft} />
    </div>
  );
}

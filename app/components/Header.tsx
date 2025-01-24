"use client";

import { Menu, Plus } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { LivesCounter } from "@/app/components/LivesCounter";
import { cn } from "@/lib/utils";
import treeGPTLogo from "@/public/treeGPTLogo.png";
import treeGPTLogoDarkMode from "@/public/treeGPTLogoDarkMode.png";
import Image from "next/image";
import { useTheme } from "next-themes";
import { SunIcon, MoonIcon } from "@heroicons/react/24/outline";

interface HeaderProps {
  onToggleSidebar: () => void;
  onNewChat: () => void;
  queriesLeft: number;
  isSidebarOpen: boolean;
}

export function Header({
  onToggleSidebar,
  onNewChat,
  queriesLeft,
  isSidebarOpen,
}: HeaderProps) {
  const { theme, setTheme } = useTheme();

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

      <Image
        src={theme === "dark" ? treeGPTLogoDarkMode : treeGPTLogo}
        alt="treeGPT Logo"
        width={150}
        height={150}
      />
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground"
        >
          <SunIcon className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <MoonIcon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </button>
      </div>
    </div>
  );
}

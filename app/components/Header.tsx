"use client";

import { Menu, Plus, HelpCircle } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { LivesCounter } from "@/app/components/LivesCounter";
import { cn } from "@/lib/utils";
import treeGPTLogo from "@/public/treeGPTLogo.png";
import treeGPTLogoDarkMode from "@/public/treeGPTLogoDarkMode.png";
import Image from "next/image";
import { useTheme } from "next-themes";
import { SunIcon, MoonIcon } from "@heroicons/react/24/outline";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { ThemeToggle } from "./ThemeToggle";
import { GitHubStars } from "./GitHubStars";

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
    <header className="sticky top-0 z-50 flex items-center justify-between w-full h-12 px-4 border-b bg-background">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="h-8 w-8"
        >
          <Menu className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNewChat}
          className="h-8 w-8"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <GitHubStars />
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <HelpCircle className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Keyboard Shortcuts</DialogTitle>
              <DialogDescription>
                <div className="space-y-4 pt-4">
                  <div>
                    <h3 className="font-medium mb-2">Navigation</h3>
                    <ul className="space-y-2">
                      <li>
                        <kbd>i</kbd> - Enter insert mode
                      </li>
                      <li>
                        <kbd>Esc</kbd> - Exit insert mode
                      </li>
                      <li>
                        <kbd>k</kbd> - Navigate to parent node
                      </li>
                      <li>
                        <kbd>j</kbd> - Navigate to child node (if only one)
                      </li>
                      <li>
                        <kbd>b</kbd> - Create new branch
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">Model Selection</h3>
                    <ul className="space-y-2">
                      <li>
                        <kbd>1</kbd> - Select Llama 3.1 (8B)
                      </li>
                      <li>
                        <kbd>2</kbd> - Select Llama 3.3 (70B)
                      </li>
                      <li>
                        <kbd>3</kbd> - Select Llama 4 Scout (17B)
                      </li>
                      <li>
                        <kbd>4</kbd> - Select Qwen 3 (32B)
                      </li>
                      <li>
                        <kbd>5</kbd> - Select DeepSeek Chat
                      </li>
                      <li>
                        <kbd>6</kbd> - Select DeepSeek Reasoner
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">Message Actions</h3>
                    <ul className="space-y-2">
                      <li>
                        <kbd>⌘</kbd> + <kbd>Enter</kbd> - Send message
                      </li>
                      <li>
                        <kbd>h</kbd> - Previous response (when multiple)
                      </li>
                      <li>
                        <kbd>l</kbd> - Next response (when multiple)
                      </li>
                    </ul>
                  </div>
                </div>
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
        <ThemeToggle />
      </div>
    </header>
  );
}

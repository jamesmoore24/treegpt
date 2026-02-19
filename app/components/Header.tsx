"use client";

import { Menu, Plus, HelpCircle, LogOut } from "lucide-react";
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
import { GitHubStars } from "./GitHubStars";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { User } from "@supabase/supabase-js";

interface HeaderProps {
  onToggleSidebar: () => void;
  onNewChat: () => void;
  queriesLeft: number;
  isSidebarOpen: boolean;
  user: User | null;
  onSignOut: () => void;
}

export function Header({
  onToggleSidebar,
  onNewChat,
  queriesLeft,
  isSidebarOpen,
  user,
  onSignOut,
}: HeaderProps) {
  const { theme, setTheme } = useTheme();

  const avatarUrl = user?.user_metadata?.avatar_url;
  const displayName = user?.user_metadata?.full_name || user?.email;
  const email = user?.email;

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
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-8 w-8 rounded-full overflow-hidden border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName || "User"}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-full w-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-medium">
                    {(displayName || "U").charAt(0).toUpperCase()}
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  {displayName && (
                    <p className="text-sm font-medium leading-none">{displayName}</p>
                  )}
                  {email && (
                    <p className="text-xs leading-none text-muted-foreground">{email}</p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="cursor-pointer"
              >
                <SunIcon className="mr-2 h-4 w-4 rotate-0 scale-100 dark:-rotate-90 dark:scale-0" />
                <MoonIcon className="absolute ml-0 h-4 w-4 rotate-90 scale-0 dark:rotate-0 dark:scale-100" />
                <span className="ml-6">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSignOut} className="cursor-pointer text-red-600 dark:text-red-400">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="h-8 w-8"
          >
            <SunIcon className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <MoonIcon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
        )}
      </div>
    </header>
  );
}

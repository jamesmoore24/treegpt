"use client";

import { cn } from "@/lib/utils";
import { Message } from "@/types/chat";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { ComponentType } from "react";
import { useState, useEffect } from "react";
import { ChevronDown, Copy, Check } from "lucide-react";
import { Button } from "./ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import "katex/dist/katex.min.css";

interface ChatMessageProps {
  message: Message & {
    reasoning?: string;
  };
  isSelected?: boolean;
  isRecent?: boolean;
  inInsertMode?: boolean;
}

const MarkdownComponents: Record<string, ComponentType<any>> = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    const language = match ? match[1] : "";
    const [copied, setCopied] = useState(false);

    const copyToClipboard = async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy text: ", err);
      }
    };

    return match ? (
      <div className="relative">
        <div className="absolute top-0 right-0 flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground bg-muted-foreground/10 rounded-bl">
          {language}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0 hover:bg-muted-foreground/20"
                  onClick={() => copyToClipboard(String(children))}
                >
                  {copied ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{copied ? "Copied!" : "Copy code"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <SyntaxHighlighter
          style={oneDark}
          language={language}
          PreTag="div"
          className="mt-2 rounded-md"
          {...props}
        >
          {String(children).replace(/\n$/, "")}
        </SyntaxHighlighter>
      </div>
    ) : (
      <code
        className="bg-muted-foreground/20 rounded px-1 py-[2px] text-sm"
        {...props}
      >
        {children}
      </code>
    );
  },
  p({ children, ...props }) {
    return (
      <p className="mb-2 last:mb-0" {...props}>
        {children}
      </p>
    );
  },
  ul({ children, ...props }) {
    return (
      <ul className="list-disc pl-6 mb-2 space-y-1" {...props}>
        {children}
      </ul>
    );
  },
  ol({ children, ...props }) {
    return (
      <ol className="list-decimal pl-6 mb-2 space-y-1" {...props}>
        {children}
      </ol>
    );
  },
  li({ children, ...props }) {
    return (
      <li className="mb-1 last:mb-0 marker:text-foreground/70" {...props}>
        {children}
      </li>
    );
  },
  blockquote({ children, ...props }) {
    return (
      <blockquote
        className="border-l-4 border-muted-foreground/40 pl-4 italic my-2"
        {...props}
      >
        {children}
      </blockquote>
    );
  },
  h1({ children, ...props }) {
    return (
      <h1 className="text-2xl font-bold mb-4" {...props}>
        {children}
      </h1>
    );
  },
  h2({ children, ...props }) {
    return (
      <h2 className="text-xl font-bold mb-3" {...props}>
        {children}
      </h2>
    );
  },
  h3({ children, ...props }) {
    return (
      <h3 className="text-lg font-bold mb-2" {...props}>
        {children}
      </h3>
    );
  },
  a({ children, href, ...props }) {
    return (
      <a
        href={href}
        className="text-blue-500 underline hover:text-blue-600"
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {children}
      </a>
    );
  },
  strong({ children, ...props }) {
    return (
      <strong className="font-bold" {...props}>
        {children}
      </strong>
    );
  },
  em({ children, ...props }) {
    return (
      <em className="italic" {...props}>
        {children}
      </em>
    );
  },
  table({ children, ...props }) {
    return (
      <div className="my-4 overflow-x-auto">
        <table
          className="min-w-full divide-y divide-muted-foreground/20"
          {...props}
        >
          {children}
        </table>
      </div>
    );
  },
  thead({ children, ...props }) {
    return (
      <thead className="bg-muted-foreground/5" {...props}>
        {children}
      </thead>
    );
  },
  tbody({ children, ...props }) {
    return (
      <tbody
        className="divide-y divide-muted-foreground/20 bg-muted-foreground/0"
        {...props}
      >
        {children}
      </tbody>
    );
  },
  tr({ children, ...props }) {
    return (
      <tr className="transition-colors hover:bg-muted-foreground/5" {...props}>
        {children}
      </tr>
    );
  },
  th({ children, ...props }) {
    return (
      <th className="px-4 py-3 text-left text-sm font-semibold" {...props}>
        {children}
      </th>
    );
  },
  td({ children, ...props }) {
    return (
      <td className="px-4 py-2 text-sm whitespace-normal" {...props}>
        {children}
      </td>
    );
  },
};

export function ChatMessage({
  message,
  isSelected = false,
  isRecent = false,
  inInsertMode = false,
}: ChatMessageProps) {
  const [showReasoning, setShowReasoning] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  // Show full content if selected or if it's the most recent message during insert mode
  useEffect(() => {
    if (isSelected || (isRecent && inInsertMode)) {
      setIsExpanded(true);
    } else {
      setIsExpanded(false);
    }
  }, [isSelected, isRecent, inInsertMode]);

  const getPreviewContent = (content: string) => {
    if (content.length <= 50) return content;
    return content.slice(0, 50) + "...";
  };

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
        {message.reasoning && (
          <div className="mb-3">
            <button
              onClick={() => setShowReasoning(!showReasoning)}
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground/70 mb-2 hover:text-muted-foreground/90 transition-colors"
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  showReasoning ? "rotate-180" : ""
                )}
              />
              Reasoning Process
            </button>
            {showReasoning && (
              <div className="text-sm text-muted-foreground/70 bg-muted-foreground/5 rounded-md p-3 border border-muted-foreground/10">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={MarkdownComponents}
                >
                  {isExpanded
                    ? message.reasoning
                    : getPreviewContent(message.reasoning)}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}
        <div
          className={cn(
            message.reasoning ? "border-t pt-3 border-muted-foreground/10" : ""
          )}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={MarkdownComponents}
          >
            {isExpanded ? message.content : getPreviewContent(message.content)}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

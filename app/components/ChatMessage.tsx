"use client";

import { cn } from "@/lib/utils";
import { Message } from "@/types/chat";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { ComponentType } from "react";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface ChatMessageProps {
  message: Message & {
    reasoning?: string;
  };
}

const MarkdownComponents: Record<string, ComponentType<any>> = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    const language = match ? match[1] : "";

    return match ? (
      <div className="relative">
        {language && (
          <div className="absolute top-0 right-0 px-2 py-1 text-xs text-muted-foreground bg-muted-foreground/10 rounded-bl">
            {language}
          </div>
        )}
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

export function ChatMessage({ message }: ChatMessageProps) {
  const [isReasoningCollapsed, setIsReasoningCollapsed] = useState(false);

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
              onClick={() => setIsReasoningCollapsed(!isReasoningCollapsed)}
              className="flex items-center gap-2 text-sm text-muted-foreground/70 hover:text-muted-foreground mb-2"
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  isReasoningCollapsed ? "-rotate-90" : ""
                )}
              />
              Reasoning
            </button>
            {!isReasoningCollapsed && (
              <div className="text-sm text-muted-foreground/70 bg-muted-foreground/5 rounded-md p-2">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={MarkdownComponents}
                >
                  {message.reasoning}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={MarkdownComponents}
        >
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

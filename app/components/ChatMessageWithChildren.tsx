import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChatMessage } from "./ChatMessage";
import { ChatNode } from "@/types/chat";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

interface ChatMessageWithChildrenProps {
  nodeId: string;
  node: ChatNode;
  chatNodes: Map<string, ChatNode>;
  currentChatNode: ChatNode | null;
  inInsertMode: boolean;
  isLastNode: boolean;
  onSelectNode: (nodeId: string) => void;
}

export function ChatMessageWithChildren({
  nodeId,
  node,
  chatNodes,
  currentChatNode,
  inInsertMode,
  isLastNode,
  onSelectNode,
}: ChatMessageWithChildrenProps) {
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);
  const hasMultipleChildren = node.children.length > 1;

  useEffect(() => {
    if (!isLastNode || !hasMultipleChildren || inInsertMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "h" && selectedChildIndex > 0) {
        setSelectedChildIndex((prev) => prev - 1);
      } else if (
        e.key === "l" &&
        selectedChildIndex < node.children.length - 1
      ) {
        setSelectedChildIndex((prev) => prev + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isLastNode,
    hasMultipleChildren,
    inInsertMode,
    selectedChildIndex,
    node.children.length,
  ]);

  return (
    <>
      <div
        key={nodeId}
        className={cn(
          "rounded-lg transition-all duration-200",
          currentChatNode?.id === nodeId
            ? "bg-yellow-100/20 border-2 border-yellow-200/30 rounded-lg p-4"
            : "",
          !inInsertMode && currentChatNode?.id !== nodeId
            ? "cursor-pointer hover:bg-accent/50"
            : "",
          !inInsertMode ? "cursor-pointer" : ""
        )}
        onClick={() => {
          if (!inInsertMode) {
            onSelectNode(nodeId);
          }
        }}
      >
        <ChatMessage message={{ content: node.query, isUser: true }} />
        <ChatMessage message={{ content: node.response, isUser: false }} />
      </div>
      {isLastNode && hasMultipleChildren && (
        <>
          <div className="text-sm font-semibold">
            {selectedChildIndex + 1}/{node.children.length}
          </div>
          <div className="flex items-center justify-between mt-4 gap-2 border-2 border-dotted border-gray-300 rounded-lg p-4">
            {selectedChildIndex !== 0 && (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedChildIndex((prev) => prev - 1);
                      }}
                      className="p-2 hover:bg-accent rounded-full transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Previous response (press <kbd>h</kbd>)
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            <div className="flex-1">
              {node.children.map((childId, childIdx) => {
                const childNode = chatNodes.get(childId);
                if (!childNode) return null;

                return (
                  <div
                    key={childId}
                    className={cn(
                      "transition-opacity duration-300",
                      childIdx === selectedChildIndex
                        ? "opacity-100"
                        : "opacity-0 hidden"
                    )}
                  >
                    <ChatMessage
                      message={{ content: childNode.query, isUser: true }}
                    />
                    <ChatMessage
                      message={{ content: childNode.response, isUser: false }}
                    />
                  </div>
                );
              })}
            </div>

            {selectedChildIndex !== node.children.length - 1 && (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedChildIndex((prev) => prev + 1);
                      }}
                      className="p-2 hover:bg-accent rounded-full transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Next response (press <kbd>l</kbd>)
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </>
      )}
    </>
  );
}

import { useState, useEffect, useRef } from "react";
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
  messageContext: string[];
  messageWindowRef: React.RefObject<HTMLDivElement>;
}

export function ChatMessageWithChildren({
  nodeId,
  node,
  chatNodes,
  currentChatNode,
  inInsertMode,
  isLastNode,
  onSelectNode,
  messageContext,
  messageWindowRef,
}: ChatMessageWithChildrenProps) {
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);
  const hasMultipleChildren = node.children.length > 1;
  const messageRef = useRef<HTMLDivElement>(null);
  const childrenContainerRef = useRef<HTMLDivElement>(null);

  // Parse reasoning and content from the response
  const parseResponse = (response: string) => {
    const reasoningMatch = response.match(
      /Reasoning:\s*([\s\S]*?)\s*Response:\s*([\s\S]*)/
    );
    if (reasoningMatch) {
      return {
        reasoning: reasoningMatch[1].trim(),
        content: reasoningMatch[2].trim(),
      };
    }
    return {
      reasoning: undefined,
      content: response.trim(),
    };
  };

  // Scroll message into view when selected
  useEffect(() => {
    if (
      currentChatNode?.id === nodeId &&
      messageRef.current &&
      messageWindowRef.current
    ) {
      const messageRect = messageRef.current.getBoundingClientRect();
      const windowRect = messageWindowRef.current.getBoundingClientRect();

      if (
        messageRect.top < windowRect.top ||
        messageRect.bottom > windowRect.bottom
      ) {
        messageRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }
  }, [currentChatNode?.id, nodeId]);

  // Scroll children container into view when navigating
  useEffect(() => {
    if (
      isLastNode &&
      hasMultipleChildren &&
      childrenContainerRef.current &&
      messageWindowRef.current
    ) {
      const containerRect =
        childrenContainerRef.current.getBoundingClientRect();
      const windowRect = messageWindowRef.current.getBoundingClientRect();

      if (
        containerRect.bottom > windowRect.bottom ||
        containerRect.top < windowRect.top
      ) {
        childrenContainerRef.current.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }
  }, [selectedChildIndex, isLastNode, hasMultipleChildren]);

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
      } else if (
        e.key === "j" &&
        currentChatNode?.id === messageContext[messageContext.length - 1]
      ) {
        const selectedChildId = node.children[selectedChildIndex];
        if (selectedChildId) {
          onSelectNode(selectedChildId);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isLastNode,
    hasMultipleChildren,
    inInsertMode,
    selectedChildIndex,
    node.children,
    onSelectNode,
  ]);

  return (
    <>
      <div
        ref={messageRef}
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
        <div className="space-y-4">
          <ChatMessage
            message={{ content: node.query, isUser: true }}
            isSelected={currentChatNode?.id === nodeId}
            isRecent={isLastNode}
            inInsertMode={inInsertMode}
          />
          <ChatMessage
            message={{
              ...parseResponse(node.response),
              isUser: false,
            }}
            isSelected={currentChatNode?.id === nodeId}
            isRecent={isLastNode}
            inInsertMode={inInsertMode}
          />
        </div>
      </div>
      {isLastNode && hasMultipleChildren && (
        <>
          <div className="text-sm font-semibold">
            {selectedChildIndex + 1}/{node.children.length}
          </div>
          <div
            ref={childrenContainerRef}
            className="flex items-center justify-between mt-4 gap-2 border-2 border-dotted border-gray-300 rounded-lg p-4 hover:bg-accent/50 cursor-pointer"
            onClick={() => {
              const selectedChildId = node.children[selectedChildIndex];
              if (selectedChildId) {
                onSelectNode(selectedChildId);
              }
            }}
          >
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
                      isSelected={false}
                      isRecent={false}
                      inInsertMode={false}
                    />
                    <ChatMessage
                      message={{ content: childNode.response, isUser: false }}
                      isSelected={false}
                      isRecent={false}
                      inInsertMode={false}
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

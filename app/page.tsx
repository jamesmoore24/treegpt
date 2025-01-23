"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { OnboardingModal } from "@/app/components/OnboardingModal";
import { ChatMessage } from "@/app/components/ChatMessage";
import { ChatSidebar } from "@/app/components/ChatSidebar";
import { Header } from "@/app/components/Header";
import { ChatHistory, Message } from "@/types/chat";
import { ChatWindow } from "@/app/components/ChatWindow";
import ReactFlow, { Background, Controls } from "reactflow";
import "reactflow/dist/style.css";
import { ChatNode } from "@/types/chat";

export default function Home() {
  const [step, setStep] = useState(1);
  const [messageContext, setMessageContext] = useState<ChatNode[]>([]);
  const [chatNodes, setChatNodes] = useState<Map<string, ChatNode>>(new Map());
  const [currentChatNode, setCurrentChatNode] = useState<ChatNode | null>(null);
  const [input, setInput] = useState("");
  const [inInsertMode, setInInsertMode] = useState(false);
  const [queriesLeft, setQueriesLeft] = useState(10);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFirstToken, setIsLoadingFirstToken] = useState(false);
  const initialized = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!initialized.current && chatHistory.length === 0) {
      initialized.current = true;
      handleNewChat();
    }
  }, [chatHistory.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "i" && !inInsertMode && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setInInsertMode(true);
        inputRef.current?.focus();
        setCurrentChatNode(null);
      } else if (e.key === "Escape" && inInsertMode) {
        setInInsertMode(false);
        inputRef.current?.blur();
        setCurrentChatNode(messageContext[messageContext.length - 1]);
      } else if (!inInsertMode && currentChatNode) {
        if (e.key === "k") {
          // Navigate to parent
          console.log("Navigating to parent", currentChatNode);
          const parentNode = currentChatNode.parentId
            ? chatNodes.get(currentChatNode.parentId)
            : null;
          if (parentNode) {
            setCurrentChatNode(parentNode);
          }
        } else {
          // Check if key is a number 1-9
          const num = parseInt(e.key);
          if (!isNaN(num) && num >= 1 && num <= 9) {
            const childIndex = num - 1;
            const childId = currentChatNode.children[childIndex];
            if (childId) {
              const childNode = chatNodes.get(childId);
              if (childNode) {
                setCurrentChatNode(childNode);
              }
            }
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inInsertMode, currentChatNode, chatNodes]);

  const handleNewChat = () => {
    const newChat: ChatHistory = {
      id: crypto.randomUUID(),
      title: "New Chat",
      timestamp: new Date(),
      messageContext: [],
      chatNodes: new Map(),
    };
    setChatHistory((prev) => [newChat, ...prev]);
    setCurrentChatId(newChat.id);
    setMessageContext([]);
    setChatNodes(new Map());

    //TODO: Create new chat object in database
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleInputFocus = () => {
    setInInsertMode(true);
    setCurrentChatNode(null);
  };

  const handleInputBlur = () => {
    setInInsertMode(false);
    setCurrentChatNode(messageContext[messageContext.length - 1]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    setIsLoadingFirstToken(true);
    setInput("");
    const userMessage = { content: input, isUser: true };
    const newMessages = [
      ...messageContext.flatMap((node) => [
        { content: node.query, isUser: true },
        { content: node.response, isUser: false },
      ]),
      userMessage,
    ];

    const newChatNodeID = `${currentChatId}-${chatNodes.size}`;

    // Create the new node object that we'll use for both states
    const newNode: ChatNode = {
      id: newChatNodeID,
      parentId:
        messageContext.length > 0
          ? messageContext[messageContext.length - 1].id
          : null,
      children: [],
      query: input,
      response: "",
    };

    // Update messageContext with the new node
    setMessageContext([...messageContext, newNode]);

    try {
      const response = await fetch("/api/chat-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((msg) => ({
            role: msg.isUser ? "user" : "assistant",
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) throw new Error(response.statusText);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No reader available");

      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        setIsLoadingFirstToken(false);

        // Handle each chunk as a complete JSON object
        const lines = chunk.split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const update = JSON.parse(line);
            fullResponse += update.content;

            // Update the node's response in messageContext
            setMessageContext((prev) => {
              const messages = [...prev];
              messages[messages.length - 1] = {
                ...messages[messages.length - 1],
                response: fullResponse.replace(/\n\n/g, "\n"),
              };
              return messages;
            });
          } catch (e) {
            console.error("Error parsing chunk:", e);
          }
        }
      }

      // After streaming is complete, update the chatNodes with parent-child relationships
      setChatNodes((prev) => {
        const updated = new Map(prev);

        // Add the new node if it doesn't exist
        if (!updated.has(newChatNodeID)) {
          updated.set(newChatNodeID, {
            ...newNode,
            response: fullResponse.replace(/\n\n/g, "\n"),
          });
        }

        // Update parent's children array if there is a parent
        if (newNode.parentId) {
          const parentNode = updated.get(newNode.parentId);
          if (parentNode && !parentNode.children.includes(newNode.id)) {
            const updatedParentNode = {
              ...parentNode,
              children: [...parentNode.children, newNode.id],
            };
            updated.set(newNode.parentId, updatedParentNode);
          }
        }

        return updated;
      });

      setIsLoading(false);

      // Generate summary for first message
      if (currentChatId && messageContext.length === 0) {
        try {
          const summaryResponse = await fetch("/api/chat-summary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: input,
              response: fullResponse,
            }),
          });

          if (summaryResponse.ok) {
            const { summary } = await summaryResponse.json();
            setChatHistory((prev) =>
              prev.map((chat) =>
                chat.id === currentChatId ? { ...chat, title: summary } : chat
              )
            );
          }
        } catch (error) {
          console.error("Error generating summary:", error);
        }
      }
    } catch (error) {
      console.error("Error:", error);
      setIsLoading(false);
    }
  };

  const handleSelectChat = (id: string) => {
    setCurrentChatId(id);
    const chat = chatHistory.find((c) => c.id === id);
    if (chat) {
      setMessageContext(chat.messageContext);
      setChatNodes(chat.chatNodes);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onNewChat={handleNewChat}
        queriesLeft={queriesLeft}
        isSidebarOpen={isSidebarOpen}
      />
      <OnboardingModal step={step} onStepChange={setStep} />
      <main className="flex-1 flex">
        <ChatSidebar
          isOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onNewChat={handleNewChat}
          history={chatHistory}
          onSelectChat={handleSelectChat}
          currentChatId={currentChatId}
        />
        <ChatWindow
          messageContext={messageContext}
          chatNodes={chatNodes}
          currentChatId={currentChatId}
          currentChatNode={currentChatNode}
          isSidebarOpen={isSidebarOpen}
          input={input}
          onInputChange={handleInputChange}
          onInputFocus={handleInputFocus}
          onInputBlur={handleInputBlur}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          isLoadingFirstToken={isLoadingFirstToken}
          inputRef={inputRef}
          inInsertMode={inInsertMode}
          onSelectNode={setCurrentChatNode}
        />
      </main>
    </div>
  );
}

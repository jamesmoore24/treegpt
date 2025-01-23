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
  const [input, setInput] = useState("");
  const [queriesLeft, setQueriesLeft] = useState(10);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFirstToken, setIsLoadingFirstToken] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current && chatHistory.length === 0) {
      initialized.current = true;
      handleNewChat();
    }
  }, [chatHistory.length]);

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

      // Add empty assistant message that we'll stream into
      const emptyMessages: ChatNode[] = [
        ...messageContext,
        {
          id: newChatNodeID,
          parentId: null,
          children: [],
          query: input,
          response: "",
        },
      ];

      setMessageContext(emptyMessages);

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
            setMessageContext((prev) => {
              const messages = [...prev];
              const lastMessage = messages[messages.length - 1];
              messages[messages.length - 1] = {
                ...lastMessage,
                response: fullResponse.replace(/\n\n/g, "\n"),
              };
              return messages;
            });
          } catch (e) {
            console.error("Error parsing chunk:", e);
          }
        }
      }
      setIsLoading(false);

      // Add the new node to chatNodes
      setChatNodes((prev) => {
        const newNode: ChatNode = {
          id: newChatNodeID,
          parentId: null,
          children: [],
          query: input,
          response: fullResponse,
        };

        // Create a new Map with the existing entries
        const updated = new Map(prev);

        if (messageContext.length > 0) {
          const lastMessageId = messageContext[messageContext.length - 1].id;
          const parentNode = updated.get(lastMessageId);
          if (parentNode) {
            const updatedParentNode = {
              ...parentNode,
              children: [...parentNode.children, newNode.id],
            };
            updated.set(lastMessageId, updatedParentNode);
            newNode.parentId = parentNode.id;
          }
        }

        updated.set(newNode.id, newNode);
        return updated;
      });

      console.log(fullResponse);
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
          isSidebarOpen={isSidebarOpen}
          input={input}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          isLoadingFirstToken={isLoadingFirstToken}
        />
      </main>
    </div>
  );
}

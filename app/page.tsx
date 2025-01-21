"use client";

import { useState } from "react";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { OnboardingModal } from "@/app/components/OnboardingModal";
import { ChatMessage } from "@/app/components/ChatMessage";
import { ChatSidebar } from "@/app/components/ChatSidebar";
import { Header } from "@/app/components/Header";
import { SplitMessage, ChatHistory } from "@/types/chat";
import { ChatWindow } from "@/app/components/ChatWindow";

export default function Home() {
  const [step, setStep] = useState(1);
  const [messages, setMessages] = useState<SplitMessage>({
    left: [],
    right: [],
  });
  const [input, setInput] = useState("");
  const [hoveredSide, setHoveredSide] = useState<"left" | "right" | null>(null);
  const [selectedSide, setSelectedSide] = useState<"left" | "right" | null>(
    null
  );
  const [queriesLeft, setQueriesLeft] = useState(10);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [responsesReady, setResponsesReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleNewChat = () => {
    const newChat: ChatHistory = {
      id: crypto.randomUUID(),
      title: "New Chat",
      timestamp: new Date(),
      messages: { left: [], right: [] },
    };
    setChatHistory((prev) => [newChat, ...prev]);
    setCurrentChatId(newChat.id);
    setMessages({ left: [], right: [] });
    setSelectedSide(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    setInput("");
    setResponsesReady(false);
    setHoveredSide(null);
    setSelectedSide(null);

    const userMessage = { content: input, isUser: true };
    const newMessages = {
      left: [...messages.left, userMessage],
      right: [...messages.right, userMessage],
    };
    setMessages(newMessages);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...newMessages.left.map((msg) => ({
              role: msg.isUser ? "user" : "assistant",
              content: msg.content,
            })),
          ],
        }),
      });

      if (!response.ok) throw new Error(response.statusText);

      // Add empty assistant messages that we'll stream into
      const emptyMessages = {
        left: [
          ...newMessages.left,
          {
            content: "",
            isUser: false,
            modelInfo: { name: "GPT-4", percentage: 75 },
          },
        ],
        right: [
          ...newMessages.right,
          {
            content: "",
            isUser: false,
            modelInfo: { name: "GPT-3.5", percentage: 25 },
          },
        ],
      };
      setMessages(emptyMessages);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No reader available");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        setIsLoading(false);

        chunk
          .split("\n")
          .filter(Boolean)
          .forEach((line) => {
            const update = JSON.parse(line) as {
              side: "left" | "right";
              content: string;
              modelInfo: any;
            };
            setMessages((prev) => {
              const side = update.side;
              const messages = [...prev[side]];
              const lastMessage = messages[messages.length - 1];
              messages[messages.length - 1] = {
                ...lastMessage,
                content: lastMessage.content + update.content,
                modelInfo: update.modelInfo,
              };
              return { ...prev, [side]: messages };
            });
          });
      }
      setResponsesReady(true);
    } catch (error) {
      console.error("Error:", error);
      setIsLoading(false);
    }
  };

  const handleSideClick = (side: "left" | "right") => {
    if (!selectedSide) {
      setSelectedSide(side);

      // Check if user selected the minority opinion
      const leftPercentage =
        messages.left[messages.left.length - 1]?.modelInfo?.percentage || 0;
      const rightPercentage =
        messages.right[messages.right.length - 1]?.modelInfo?.percentage || 0;
      const selectedPercentage =
        side === "left" ? leftPercentage : rightPercentage;

      if (selectedPercentage < 50) {
        setQueriesLeft((prev) => Math.max(0, prev - 1));
      }
    }
  };

  const handleSelectChat = (id: string) => {
    setCurrentChatId(id);
    const chat = chatHistory.find((c) => c.id === id);
    if (chat) {
      setMessages(chat.messages);
      setSelectedSide(null);
    }
  };

  return (
    <main className="h-screen flex flex-col">
      <OnboardingModal step={step} onStepChange={setStep} />

      <Header
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onNewChat={handleNewChat}
        queriesLeft={queriesLeft}
        isSidebarOpen={isSidebarOpen}
      />

      <div className="flex-1 flex relative">
        <ChatSidebar
          isOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onNewChat={handleNewChat}
          history={chatHistory}
          onSelectChat={handleSelectChat}
          currentChatId={currentChatId}
        />

        <div className={cn("flex-1 flex", isSidebarOpen && "ml-64")}>
          <ChatWindow
            messages={messages}
            hoveredSide={hoveredSide}
            selectedSide={selectedSide}
            responsesReady={responsesReady}
            isSidebarOpen={isSidebarOpen}
            input={input}
            onInputChange={(e) => setInput(e.target.value)}
            onSubmit={handleSubmit}
            onHover={setHoveredSide}
            onClick={handleSideClick}
            isLoading={isLoading}
          />
        </div>
      </div>
    </main>
  );
}

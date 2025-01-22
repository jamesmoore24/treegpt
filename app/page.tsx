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
import { ChatHistory, Message } from "@/types/chat";
import { ChatWindow } from "@/app/components/ChatWindow";
import ReactFlow, { Background, Controls } from "reactflow";
import "reactflow/dist/style.css";

export default function Home() {
  const [step, setStep] = useState(1);
  const [messages, setMessages] = useState<Message[]>([]);
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
    setMessages([]);
    setSelectedSide(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    setInput("");
    const userMessage = { content: input, isUser: true };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    try {
      const response = await fetch("/api/chat", {
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
      const emptyMessages = [
        ...newMessages,
        {
          content: "",
          isUser: false,
          modelInfo: { name: "GPT-4", percentage: 75 },
        },
      ];
      setMessages(emptyMessages);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No reader available");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        setIsLoading(false);

        // Handle each chunk as a complete JSON object
        const lines = chunk.split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const update = JSON.parse(line);
            setMessages((prev) => {
              const messages = [...prev];
              const lastMessage = messages[messages.length - 1];
              messages[messages.length - 1] = {
                ...lastMessage,
                content: (lastMessage.content + update.content).replace(
                  /\n\n/g,
                  "\n"
                ),
                modelInfo: update.modelInfo,
              };
              return messages;
            });
          } catch (e) {
            console.error("Error parsing chunk:", e);
          }
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
      setMessages(chat.messages.left.concat(chat.messages.right));
      setSelectedSide(null);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <OnboardingModal step={step} onStepChange={setStep} />
      <main className="flex-1 flex">
        <ChatWindow
          messages={messages}
          isSidebarOpen={isSidebarOpen}
          input={input}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />
      </main>
    </div>
  );
}

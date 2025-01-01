"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { OnboardingModal } from "@/components/OnboardingModal";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatSidebar } from "@/components/ChatSidebar";
import { Header } from "@/components/Header";
import { SplitMessage, ChatHistory } from "@/types/chat";

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
    if (!input.trim()) return;

    const userMessage = { content: input, isUser: true };
    const newMessages = {
      left: [...messages.left, userMessage],
      right: [...messages.right, userMessage],
    };
    setMessages(newMessages);

    // Update chat history if we're in a chat
    if (currentChatId) {
      setChatHistory((prev) =>
        prev.map((chat) =>
          chat.id === currentChatId ? { ...chat, messages: newMessages } : chat
        )
      );
    }

    // Simulate model responses (replace with actual API calls)
    const leftResponse = {
      content: "This is a response from Model A",
      isUser: false,
      modelInfo: {
        name: "GPT-4",
        percentage: 75,
      },
    };

    const rightResponse = {
      content: "This is a response from Model B",
      isUser: false,
      modelInfo: {
        name: "Claude",
        percentage: 25,
      },
    };

    setTimeout(() => {
      const updatedMessages = {
        left: [...newMessages.left, leftResponse],
        right: [...newMessages.right, rightResponse],
      };
      setMessages(updatedMessages);

      // Update chat history
      if (currentChatId) {
        setChatHistory((prev) =>
          prev.map((chat) =>
            chat.id === currentChatId
              ? { ...chat, messages: updatedMessages }
              : chat
          )
        );
      }
    }, 1000);

    setInput("");
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

        <div
          className={cn("flex-1 flex transition-all", isSidebarOpen && "ml-64")}
        >
          {/* Left Side */}
          <div
            className={cn(
              "flex-1 p-4 relative overflow-auto",
              hoveredSide === "left" && !selectedSide && "bg-primary/5"
            )}
            onMouseEnter={() => setHoveredSide("left")}
            onMouseLeave={() => setHoveredSide(null)}
            onClick={() => handleSideClick("left")}
          >
            <div className="space-y-4">
              {messages.left.map((msg, idx) => (
                <ChatMessage
                  key={idx}
                  message={msg}
                  showModelInfo={!!selectedSide}
                />
              ))}
            </div>
          </div>

          {/* Right Side */}
          <div
            className={cn(
              "flex-1 p-4 relative overflow-auto border-l",
              hoveredSide === "right" && !selectedSide && "bg-primary/5"
            )}
            onMouseEnter={() => setHoveredSide("right")}
            onMouseLeave={() => setHoveredSide(null)}
            onClick={() => handleSideClick("right")}
          >
            <div className="space-y-4">
              {messages.right.map((msg, idx) => (
                <ChatMessage
                  key={idx}
                  message={msg}
                  showModelInfo={!!selectedSide}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div
          className={cn(
            "max-w-4xl mx-auto flex gap-2 transition-all",
            isSidebarOpen && "ml-64"
          )}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1"
          />
          <Button type="submit">
            <MessageSquare className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </main>
  );
}

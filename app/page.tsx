"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { SignInModal } from "@/app/components/SignInModal";
import { ChatSidebar } from "@/app/components/ChatSidebar";
import { Header } from "@/app/components/Header";
import { ChatHistory, Message } from "@/types/chat";
import { ChatWindow } from "@/app/components/ChatWindow";
import ReactFlow, { Background, Controls } from "reactflow";
import "reactflow/dist/style.css";
import { ChatNode } from "@/types/chat";
import { ModelType } from "@/app/components/ChatWindow";
import { TokenUsage } from "@/types/tokenUsage";
import { Textarea } from "@/app/components/ui/textarea";
import { useAuth } from "@/app/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";

const modelConfigs = {
  "llama3.1-8b": {
    name: "Llama 3.1 8B",
    pricing: {
      inputTokensCached: 0,
      inputTokens: 0.10,
      outputTokens: 0.10,
    },
  },
  "gpt-oss-120b": {
    name: "GPT OSS 120B",
    pricing: {
      inputTokensCached: 0,
      inputTokens: 0.35,
      outputTokens: 0.75,
    },
  },
  "qwen-3-235b-a22b-instruct-2507": {
    name: "Qwen 3 235B",
    pricing: {
      inputTokensCached: 0,
      inputTokens: 0.60,
      outputTokens: 1.20,
    },
  },
  "deepseek-chat": {
    name: "DeepSeek V3",
    pricing: {
      inputTokensCached: 0.028,
      inputTokens: 0.28,
      outputTokens: 0.42,
    },
  },
  "deepseek-reasoner": {
    name: "DeepSeek Reasoner",
    pricing: {
      inputTokensCached: 0.028,
      inputTokens: 0.28,
      outputTokens: 0.42,
    },
  },
} as const;

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const [messageContext, setMessageContext] = useState<string[]>([]);
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
  const [selectedModel, setSelectedModel] = useState<ModelType>("llama3.1-8b");
  const [tokenUsage, setTokenUsage] = useState<Map<string, TokenUsage>>(
    new Map()
  );
  const [rlmMode, setRlmMode] = useState(false);

  // Load chats from Supabase when user is authenticated
  useEffect(() => {
    if (!user || initialized.current) return;
    initialized.current = true;

    const loadChats = async () => {
      const { data: chatsData, error } = await supabase
        .from("chats")
        .select("*, chat_nodes(*)")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error || !chatsData || chatsData.length === 0) {
        handleNewChat();
        return;
      }

      const reconstructed: ChatHistory[] = chatsData.map((chat: any) => {
        const nodesMap = new Map<string, ChatNode>();
        (chat.chat_nodes || []).forEach((n: any) => {
          nodesMap.set(n.id, {
            id: n.id,
            parentId: n.parent_id,
            children: n.children || [],
            query: n.query,
            response: n.response,
            model: n.model,
          });
        });
        return {
          id: chat.id,
          title: chat.title,
          timestamp: new Date(chat.updated_at),
          messageContext: chat.message_context || [],
          chatNodes: nodesMap,
        };
      });

      setChatHistory(reconstructed);
      const most = reconstructed[0];
      setCurrentChatId(most.id);
      setMessageContext(most.messageContext);
      setChatNodes(most.chatNodes);
    };

    loadChats();
  }, [user]);

  useEffect(() => {
    if (initialized.current && currentChatId) {
      setChatHistory((prev) =>
        prev.map((chat) =>
          chat.id === currentChatId
            ? { ...chat, messageContext, chatNodes, timestamp: new Date() }
            : chat
        )
      );
      // Persist message_context to Supabase
      if (user) {
        supabase
          .from("chats")
          .update({ message_context: messageContext, updated_at: new Date().toISOString() })
          .eq("id", currentChatId)
          .then(() => {});
      }
    }
  }, [messageContext, chatNodes, currentChatId]);

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
        const lastNodeId = messageContext[messageContext.length - 1];
        if (lastNodeId) {
          const lastNode = chatNodes.get(lastNodeId);
          if (lastNode) {
            setCurrentChatNode(lastNode);
          }
        }
      } else if (!inInsertMode && currentChatNode) {
        if (e.key === "k") {
          // Navigate to parent
          const parentNode = currentChatNode.parentId
            ? chatNodes.get(currentChatNode.parentId)
            : null;
          if (parentNode) {
            handleSelectNode(parentNode.id);
          }
        } else if (e.key === "j") {
          // Navigate to only child
          if (currentChatNode.children.length === 1) {
            const childId = currentChatNode.children[0];
            handleSelectNode(childId);
          }
        } else if (e.key === "b") {
          // Handle branching
          handleBranch();
          setTimeout(() => setInput(""), 10);
        } else {
          // Check if key is a number 1-9 for multiple children
          const num = parseInt(e.key);
          if (
            !isNaN(num) &&
            num >= 1 &&
            num <= 9 &&
            currentChatNode.children.length > 1
          ) {
            const childIndex = num - 1;
            const childId = currentChatNode.children[childIndex];
            if (childId) {
              const childNode = chatNodes.get(childId);
              if (childNode) {
                handleSelectNode(childNode.id);
              }
            }
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inInsertMode, currentChatNode, chatNodes, messageContext]);

  const handleNewChat = async () => {
    const newId = crypto.randomUUID();
    const newChat: ChatHistory = {
      id: newId,
      title: "New Chat",
      timestamp: new Date(),
      messageContext: [],
      chatNodes: new Map(),
    };
    setChatHistory((prev) => [newChat, ...prev]);
    setCurrentChatId(newId);
    setMessageContext([]);
    setChatNodes(new Map());

    if (user) {
      await supabase.from("chats").insert({
        id: newId,
        user_id: user.id,
        title: "New Chat",
        message_context: [],
      });
    }
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
    const lastNodeId = messageContext[messageContext.length - 1];
    const lastNode = lastNodeId ? chatNodes.get(lastNodeId) : null;
    setCurrentChatNode(lastNode || null);
  };

  const handleSubmit = async (e: React.FormEvent, pdfText?: string, pdfName?: string) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    setIsLoadingFirstToken(true);
    setInput("");

    // Create messages array for API call — append PDF content to last user message if provided
    const lastContent = pdfText
      ? `${input}\n\n[Attached PDF Content]\n${pdfText}`
      : input;
    const newMessages = [
      ...messageContext.flatMap((nodeId) => {
        const node = chatNodes.get(nodeId);
        if (!node) return [];
        return [
          { content: node.query, isUser: true },
          { content: node.response, isUser: false },
        ];
      }),
      { content: lastContent, isUser: true },
    ];

    const newChatNodeID = `${currentChatId}-${chatNodes.size}`;

    // Create the new node object
    const newNode: ChatNode = {
      id: newChatNodeID,
      parentId:
        messageContext.length > 0
          ? messageContext[messageContext.length - 1]
          : null,
      children: [],
      query: input,
      response: "",
      model: modelConfigs[selectedModel].name,
      pdfName,
    };

    // Initialize the node in chatNodes
    setChatNodes((prev) => {
      const updated = new Map(prev);
      updated.set(newChatNodeID, newNode);

      // Update parent's children array if there is a parent
      if (newNode.parentId) {
        const parentNode = updated.get(newNode.parentId);
        if (parentNode) {
          updated.set(newNode.parentId, {
            ...parentNode,
            children: [...parentNode.children, newNode.id],
          });
        }
      }

      return updated;
    });

    // Persist new node to Supabase
    if (user) {
      await supabase.from("chat_nodes").insert({
        id: newChatNodeID,
        chat_id: currentChatId,
        user_id: user.id,
        parent_id: newNode.parentId,
        children: [],
        query: newNode.query,
        response: "",
        model: newNode.model,
      });
    }

    // Update messageContext with the new node's ID
    setMessageContext([...messageContext, newNode.id]);

    try {
      const response = await fetch("/api/chat-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((msg) => ({
            role: msg.isUser ? "user" : "assistant",
            content: msg.content,
          })),
          model: selectedModel,
        }),
      });

      if (!response.ok) throw new Error(response.statusText);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No reader available");

      let fullResponse = "";
      let fullReasoning = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        setIsLoadingFirstToken(false);

        const lines = chunk.split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const update = JSON.parse(line);

            // Handle reasoning content
            if (update.reasoning) {
              fullReasoning += update.reasoning;
              // Update the node's response in chatNodes with reasoning
              setChatNodes((prev) => {
                const updated = new Map(prev);
                const nodeToUpdate = updated.get(newChatNodeID);
                if (nodeToUpdate) {
                  updated.set(newChatNodeID, {
                    ...nodeToUpdate,
                    response:
                      `Reasoning:\n${fullReasoning}\n\nResponse:\n${fullResponse}`.replace(
                        /\n\n/g,
                        "\n"
                      ),
                  });
                }
                return updated;
              });
            } else if (update.content) {
              fullResponse += update.content;
              // Update the node's response in chatNodes
              setChatNodes((prev) => {
                const updated = new Map(prev);
                const nodeToUpdate = updated.get(newChatNodeID);
                if (nodeToUpdate) {
                  const response = fullReasoning
                    ? `Reasoning:\n${fullReasoning}\n\nResponse:\n${fullResponse}`
                    : fullResponse;
                  updated.set(newChatNodeID, {
                    ...nodeToUpdate,
                    response: response.replace(/\n\n/g, "\n"),
                  });
                }
                return updated;
              });
            }

            // Update token usage if available
            if (update.modelInfo?.usage) {
              setTokenUsage((prev) => {
                const updated = new Map(prev);
                updated.set(newChatNodeID, {
                  inputTokens: update.modelInfo.usage.inputTokens,
                  outputTokens: update.modelInfo.usage.outputTokens,
                  cached: update.modelInfo.usage.cached,
                });
                return updated;
              });
            }
          } catch (e) {
            console.error("Error parsing chunk:", e);
          }
        }
      }

      setIsLoading(false);

      // Persist completed response to Supabase
      if (user) {
        await supabase
          .from("chat_nodes")
          .update({ response: fullResponse })
          .eq("id", newChatNodeID);
        // Update parent's children array in Supabase
        if (newNode.parentId) {
          const parentNode = chatNodes.get(newNode.parentId);
          if (parentNode) {
            await supabase
              .from("chat_nodes")
              .update({ children: [...parentNode.children, newChatNodeID] })
              .eq("id", newNode.parentId);
          }
        }
      }

      // Update chat title after every message
      if (currentChatId) {
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
            if (user) {
              await supabase
                .from("chats")
                .update({ title: summary })
                .eq("id", currentChatId);
            }
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
    // Save current chat state before switching
    if (currentChatId) {
      setChatHistory((prev) =>
        prev.map((chat) =>
          chat.id === currentChatId
            ? { ...chat, messageContext, chatNodes, timestamp: new Date() }
            : chat
        )
      );
    }

    // Switch to selected chat
    setCurrentChatId(id);
    const chat = chatHistory.find((c) => c.id === id);
    if (chat) {
      setMessageContext(chat.messageContext);
      setChatNodes(chat.chatNodes);
    }
  };

  const handleSelectNode = (nodeId: string) => {
    const node = chatNodes.get(nodeId);
    if (!node) return;

    setCurrentChatNode(node);

    // Build path to root through parent nodes
    const pathToRoot: string[] = [];
    let currentNodeId = nodeId;

    while (currentNodeId) {
      pathToRoot.unshift(currentNodeId);
      const currentNode = chatNodes.get(currentNodeId);
      currentNodeId = currentNode?.parentId || "";
    }

    // Follow single-child path downwards
    let lastNodeId = nodeId;
    let lastNode = chatNodes.get(lastNodeId);
    while (lastNode && lastNode.children.length === 1) {
      const childId = lastNode.children[0];
      const childNode = chatNodes.get(childId);
      if (!childNode) break;
      pathToRoot.push(childId);
      lastNodeId = childId;
      lastNode = childNode;
    }
    setMessageContext(pathToRoot);
  };

  const handleBranch = () => {
    if (!currentChatNode || inInsertMode) return;

    // If no children, just enter insert mode
    if (currentChatNode.children.length === 0) {
      setInInsertMode(true);
      inputRef.current?.focus();
      return;
    }

    // If has children, truncate messageContext at current node and enter insert mode
    const currentNodeIndex = messageContext.findIndex(
      (nodeId) => nodeId === currentChatNode.id
    );
    if (currentNodeIndex !== -1) {
      setMessageContext(messageContext.slice(0, currentNodeIndex + 1));
      setInInsertMode(true);
      inputRef.current?.focus();
    }
  };

  if (authLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen max-h-screen overflow-hidden bg-background">
      <Header
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onNewChat={handleNewChat}
        queriesLeft={queriesLeft}
        isSidebarOpen={isSidebarOpen}
      />
      {!user && <SignInModal />}
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
          onSelectNode={handleSelectNode}
          onBranch={handleBranch}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          tokenUsage={tokenUsage}
          rlmMode={rlmMode}
          onToggleRlmMode={() => setRlmMode((v) => !v)}
        />
      </main>
    </div>
  );
}

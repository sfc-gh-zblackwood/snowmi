"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, X, Sparkles, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardCard, CardType } from "@/lib/dashboard-state";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: ChatAction | null;
  timestamp: Date;
}

interface ChatAction {
  type: string;
  card?: Partial<DashboardCard>;
  targetCard?: string;
  cardToMove?: string;
  position?: string;
  updates?: Partial<DashboardCard>;
  style?: {
    type?: CardType;
    size?: string;
  };
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onAction?: (action: ChatAction) => void;
  initialMessage?: string;
  onMessageSent?: () => void;
  currentCards?: { id: string; title: string; type: CardType }[];
}

const SUGGESTIONS = [
  "Show me DAU trend for the last 2 weeks",
  "Top 10 accounts by requests",
  "Weekly credit consumption",
  "Show top tools by usage",
  "Show pipeline data freshness",
  "Which accounts grew the most?",
];

export function ChatPanel({ isOpen, onClose, onAction, initialMessage, onMessageSent, currentCards }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Tell me what you'd like to see! I can create charts, tables, and metrics from your Snowflake data. Try something like \"Show me a 14-day DAU trend\" or \"Top accounts by usage\".",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialMessage && isOpen && initialMessage !== input) {
      setInput(initialMessage);
      setPendingMessage(initialMessage);
    }
  }, [initialMessage, isOpen]);

  useEffect(() => {
    if (pendingMessage && isOpen && !isLoading) {
      sendMessage(pendingMessage);
      setPendingMessage(null);
      onMessageSent?.();
    }
  }, [pendingMessage, isOpen, isLoading]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    setShowSuggestions(false);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const conversationHistory = messages.slice(-6).map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          context: {
            currentCards: currentCards || [],
            conversationHistory,
          }
        }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response || data.error || "Something went wrong",
        action: data.action,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (data.action && onAction) {
        onAction(data.action);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Sorry, I had trouble processing that request. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-[420px] h-[650px] flex flex-col rounded-xl shadow-2xl bg-slate-900 border border-slate-700 z-50">
      <div className="flex flex-row items-center justify-between py-3 px-4 border-b border-slate-700">
        <div className="text-sm font-medium flex items-center gap-2 text-white">
          <Sparkles className="h-4 w-4 text-cyan-400" />
          AI Dashboard Builder
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex flex-col gap-1",
              message.role === "user" ? "items-end" : "items-start"
            )}
          >
            <div
              className={cn(
                "rounded-lg px-3 py-2 max-w-[90%] text-sm",
                message.role === "user"
                  ? "bg-cyan-500 text-white"
                  : "bg-slate-800 text-slate-100"
              )}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              {message.action?.type === "add_card" && (
                <div className="mt-2 pt-2 border-t border-slate-700 text-xs text-cyan-400 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-cyan-400"></span>
                  Card added to dashboard
                </div>
              )}
              {message.action?.type === "remove_card" && (
                <div className="mt-2 pt-2 border-t border-slate-700 text-xs text-amber-400 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-400"></span>
                  Card removed
                </div>
              )}
              {message.action?.type === "modify_card" && (
                <div className="mt-2 pt-2 border-t border-slate-700 text-xs text-emerald-400 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
                  Card updated
                </div>
              )}
              {message.action?.type === "reorder_cards" && (
                <div className="mt-2 pt-2 border-t border-slate-700 text-xs text-purple-400 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-purple-400"></span>
                  Cards reordered
                </div>
              )}
              {message.action?.type === "style_card" && (
                <div className="mt-2 pt-2 border-t border-slate-700 text-xs text-pink-400 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-pink-400"></span>
                  Style updated
                </div>
              )}
            </div>
            <span className="text-[10px] text-slate-500 px-1">
              {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ))}

        {showSuggestions && messages.length <= 1 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Lightbulb className="h-3 w-3" />
              Try asking:
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(suggestion)}
                  className="text-xs px-3 py-1.5 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex items-start gap-2">
            <div className="rounded-lg px-3 py-2 bg-slate-800 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
              <span className="text-xs text-slate-400">Generating with Cortex...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-slate-700 p-3">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to see..."
            className="flex-1 h-10 text-sm bg-slate-800 border-slate-600 text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-cyan-500"
            disabled={isLoading}
          />
          <Button
            size="icon"
            className="h-10 w-10 bg-cyan-500 hover:bg-cyan-400 text-slate-900"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-slate-500 mt-2 text-center">
          Powered by Snowflake Cortex • Ask anything about your data
        </p>
      </div>
    </div>
  );
}

export function ChatToggleButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-4 right-4 h-14 px-4 rounded-full shadow-lg z-40 bg-cyan-500 hover:bg-cyan-400 transition-colors flex items-center gap-2 text-slate-900 font-medium"
    >
      <Sparkles className="h-5 w-5" />
      <span>Build with AI</span>
    </button>
  );
}

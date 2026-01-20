"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, Loader2, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  data?: Record<string, unknown>[] | null;
  widgetType?: string | null;
  timestamp: Date;
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onWidgetAdd?: (widgetType: string, data: Record<string, unknown>[]) => void;
  initialMessage?: string;
}

const QUICK_ACTIONS = [
  { label: "Pipeline Health", query: "check data freshness" },
  { label: "Credit Changes", query: "show credit changes" },
  { label: "SI Metrics", query: "snowflake intelligence usage" },
  { label: "150 MAU", query: "150 MAU milestone progress" },
  { label: "Spikes", query: "find usage spikes" },
];

export function ChatPanel({ isOpen, onClose, onWidgetAdd, initialMessage }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hey! I can help you explore your data and customize this dashboard. Try asking about credit changes, usage spikes, or pipeline health.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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
    if (initialMessage && isOpen) {
      setInput(initialMessage);
    }
  }, [initialMessage, isOpen]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

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
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response || data.error || "Something went wrong",
        data: data.data,
        widgetType: data.widgetType,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (data.widgetType && data.data && onWidgetAdd) {
        onWidgetAdd(data.widgetType, data.data);
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
    <div className="fixed bottom-4 right-4 w-96 h-[600px] flex flex-col rounded-xl shadow-2xl bg-slate-900 border border-slate-700 z-50">
      <div className="flex flex-row items-center justify-between py-3 px-4 border-b border-slate-700">
        <div className="text-sm font-medium flex items-center gap-2 text-white">
          <Sparkles className="h-4 w-4 text-cyan-400" />
          Dashboard Assistant
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
                "rounded-lg px-3 py-2 max-w-[85%] text-sm",
                message.role === "user"
                  ? "bg-cyan-500 text-white"
                  : "bg-slate-800 text-slate-100"
              )}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
            </div>
            <span className="text-[10px] text-slate-500 px-1">
              {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start gap-2">
            <div className="rounded-lg px-3 py-2 bg-slate-800">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-slate-700 p-3 space-y-3">
        <div className="flex flex-wrap gap-1">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              className="h-6 text-xs px-2 rounded-md border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50"
              onClick={() => sendMessage(action.query)}
              disabled={isLoading}
            >
              {action.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your data..."
            className="flex-1 h-9 text-sm bg-slate-800 border-slate-600 text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-cyan-500"
            disabled={isLoading}
          />
          <Button
            size="icon"
            className="h-9 w-9 bg-cyan-500 hover:bg-cyan-400 text-slate-900"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ChatToggleButton({ onClick, hasNewMessage }: { onClick: () => void; hasNewMessage?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-20 right-4 h-12 w-12 rounded-full shadow-lg z-40 bg-cyan-500 hover:bg-cyan-400 transition-colors flex items-center justify-center text-slate-900"
    >
      <MessageCircle className="h-5 w-5" />
      {hasNewMessage && (
        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500" />
      )}
    </button>
  );
}

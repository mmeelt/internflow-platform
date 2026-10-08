"use client";

import { useState, useRef, useEffect } from "react";

import { Send, Sparkles, Plus, X, FileText } from "lucide-react";

export interface AiMessage {
  id: string;
  role: "user" | "assistant";
  content: string; 
  timestamp: Date;
  sources?: string[];
}

export type AiChatResult = string | { answer: string; sources?: string[] };

interface AiChatProps {
  welcomeTitle?: string;
  welcomeSubtitle?: string;
  initialMessage?: string;
  suggestions?: string[];
  getResponse: (input: string) => AiChatResult | Promise<AiChatResult>;
  getSources?: (input: string) => string[];
  variant?: "panel" | "fullscreen" | "embedded";
  onClose?: () => void;
  userName?: string;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderContent(text: string, dark = false) {
  return text.split("\n").map((line, i) => {
    const parts = line.split(/\*\*(.*?)\*\*/g);
    return (
      <span key={i} className="block">
        {parts.map((part, j) =>
          j % 2 === 1 ? (
            <strong key={j} className={`font-semibold ${dark ? "text-white" : "text-charcoal"}`}>
              {part}
            </strong>
          ) : (
            <span key={j}>{part}</span>
          )
        )}
      </span>
    );
  });
}

export function AiChat({
  welcomeTitle = "Ask Intern Portal AI",
  welcomeSubtitle = "Search guidelines, deadlines, tasks, and project docs…",
  initialMessage = "Hello! I'm your **Intern Portal AI assistant**. I can answer questions about your workspace, tasks, deadlines, documents, and more.\n\nHow can I help you today?",
  suggestions = [
    "What are my deadlines?",
    "How do I format my report?",
    "How is my progress scored?",
    "How do I contact my supervisor?",
  ],
  getResponse,
  getSources,
  variant = "panel",
  onClose,
  userName = "there",
}: AiChatProps) {
  const [messages, setMessages] = useState<AiMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: initialMessage,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (variant !== "embedded") {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [variant]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: AiMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const result = await getResponse(text);
      const response = typeof result === "string" ? result : result.answer;
      const sources = typeof result === "string" ? (getSources?.(text) ?? []) : (result.sources ?? []);
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: response,
          timestamp: new Date(),
          sources: sources.length > 0 ? sources : undefined,
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The AI assistant is temporarily unavailable.";
      setIsTyping(false);
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(), role: "assistant", content: message, timestamp: new Date(),
      }]);
    }
  };

  const isFullscreen = variant === "fullscreen";
  const isEmbedded = variant === "embedded";
  const showWelcome = messages.length === 1 && !isTyping;

  const containerClass = isFullscreen
    ? "fixed inset-0 z-[60] ai-gradient-bg flex flex-col"
    : isEmbedded
    ? "flex flex-col h-full ai-gradient-bg"
    : "flex flex-col h-full ai-gradient-bg rounded-3xl overflow-hidden border border-border shadow-float";

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className={`flex items-center justify-between px-6 py-4 shrink-0 ${isFullscreen ? "pt-6" : ""}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-charcoal flex items-center justify-center shadow-card">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-charcoal">Intern Portal AI</p>
            <p className="text-xs text-muted">Protected workspace assistant</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-border bg-white text-muted hover:text-charcoal hover:bg-cream-dark flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {showWelcome && (
          <div className="text-center mb-8 mt-4">
            <h2 className="text-2xl font-bold text-charcoal mb-2">
              Welcome back{userName !== "there" ? `, ${userName.split(" ")[0]}` : ""}
            </h2>
            <p className="text-sm text-muted max-w-md mx-auto">{welcomeSubtitle}</p>
          </div>
        )}

        <div className={`max-w-2xl mx-auto space-y-4 ${showWelcome ? "" : "pt-2"}`}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className="max-w-[85%]">
                <div className={msg.role === "user" ? "ai-bubble-user" : "ai-bubble-assistant"}>
                  {renderContent(msg.content, msg.role === "assistant")}
                </div>

                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {msg.sources.map((src) => (
                      <div
                        key={src}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-border text-xs text-muted shadow-card"
                      >
                        <FileText className="w-3 h-3 text-charcoal" />
                        {src}
                      </div>
                    ))}
                  </div>
                )}

                <p
                  className={`text-[10px] mt-1.5 text-muted-light ${
                    msg.role === "user" ? "text-right" : "text-left"
                  }`}
                >
                  {formatTime(msg.timestamp)}
                </p>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="ai-bubble-assistant">
                <div className="flex gap-1.5 items-center h-4">
                  {[0, 150, 300].map((d) => (
                    <span
                      key={d}
                      className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce"
                      style={{ animationDelay: `${d}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Suggestions */}
      {showWelcome && (
        <div className="px-6 pb-3 flex flex-wrap gap-2 justify-center max-w-2xl mx-auto w-full">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => void sendMessage(s)}
              className="text-xs px-4 py-2 rounded-full border border-border bg-white text-charcoal-soft hover:border-charcoal/20 hover:bg-cream-dark transition-colors shadow-card"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Sooma-style input bar */}
      <div className={`px-6 pb-6 shrink-0 ${isFullscreen ? "pb-8" : ""}`}>
        <div className="max-w-2xl mx-auto ai-input-bar">
          <button className="w-8 h-8 rounded-full border border-border bg-cream-dark text-muted hover:text-charcoal flex items-center justify-center shrink-0 transition-colors">
            <Plus className="w-4 h-4" />
          </button>
          <input
            ref={inputRef}
            type="text"
            placeholder={welcomeTitle}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(input);
              }
            }}
            disabled={isTyping}
            className="flex-1 bg-transparent text-sm text-charcoal placeholder:text-muted-light outline-none disabled:opacity-50"
          />
          <button
            onClick={() => void sendMessage(input)}
            disabled={isTyping || !input.trim()}
            className="w-10 h-10 rounded-full bg-charcoal text-white flex items-center justify-center shrink-0 hover:bg-charcoal-soft transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

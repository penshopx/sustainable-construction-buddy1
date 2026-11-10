import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import {
  Send, Loader2, Bot, User, Trash2, Plus,
  MessageCircle, Clock, ChevronLeft,
} from "lucide-react";
import type { Msg, MentorConversation } from "@/hooks/useMentorChat";

interface MentorChatPanelProps {
  messages: Msg[];
  isLoading: boolean;
  conversations: MentorConversation[];
  activeConversationId: string | null;
  onSend: (text: string) => void;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  quickPrompts?: { icon: React.ElementType; text: string }[];
  emptyTitle?: string;
  emptyDescription?: string;
  accentColor?: string;
}

export default function MentorChatPanel({
  messages, isLoading, conversations, activeConversationId,
  onSend, onSelectConversation, onNewConversation, onDeleteConversation,
  quickPrompts, emptyTitle, emptyDescription, accentColor = "text-pub-amber",
}: MentorChatPanelProps) {
  const [input, setInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = (text?: string) => {
    const msg = text || input.trim();
    if (!msg || isLoading) return;
    onSend(msg);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  if (showHistory) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => setShowHistory(false)} className="p-1.5 rounded-lg hover:bg-muted"><ChevronLeft className="w-5 h-5" /></button>
          <h3 className="font-heading font-bold text-foreground">Riwayat Percakapan</h3>
          <button onClick={() => { onNewConversation(); setShowHistory(false); }} className="ml-auto flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:brightness-110">
            <Plus className="w-3.5 h-3.5" /> Baru
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1.5">
          {conversations.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Belum ada percakapan</p>}
          {conversations.map(c => (
            <div key={c.id} className={`flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-colors ${c.id === activeConversationId ? "bg-primary/10 border border-primary/20" : "hover:bg-muted border border-transparent"}`}
              onClick={() => { onSelectConversation(c.id); setShowHistory(false); }}>
              <MessageCircle className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-foreground">{c.title || "Percakapan"}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(c.updated_at).toLocaleDateString("id-ID")}
                </p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); onDeleteConversation(c.id); }}
                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-2xl border border-border bg-card shadow-sm p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className={`w-14 h-14 rounded-2xl bg-pub-amber/10 flex items-center justify-center mb-4`}>
              <Bot className={`w-7 h-7 ${accentColor}`} />
            </div>
            <h3 className="font-heading font-bold text-foreground text-lg mb-2">{emptyTitle || "Mulai Percakapan"}</h3>
            <p className="text-sm text-muted-foreground font-body max-w-md mb-6">{emptyDescription || "Silakan ketik pertanyaan atau pilih topik di bawah."}</p>
            {quickPrompts && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {quickPrompts.map((qp, i) => (
                  <button key={i} onClick={() => handleSend(qp.text)}
                    className="flex items-start gap-3 p-3 rounded-xl border border-border bg-background hover:bg-muted transition-colors text-left group">
                    <qp.icon className={`w-5 h-5 ${accentColor} shrink-0 mt-0.5`} />
                    <span className="text-xs font-body text-muted-foreground group-hover:text-foreground transition-colors">{qp.text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-lg bg-pub-amber/10 flex items-center justify-center shrink-0 mt-1">
                  <Bot className={`w-4 h-4 ${accentColor}`} />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-tr-md" : "bg-muted text-foreground rounded-tl-md"}`}>
                {msg.role === "assistant" ? (
                  <MarkdownRenderer className="[&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm">{msg.content}</MarkdownRenderer>
                ) : (
                  <p className="text-sm font-body whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4 text-primary" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-pub-amber/10 flex items-center justify-center shrink-0">
              <Bot className={`w-4 h-4 ${accentColor}`} />
            </div>
            <div className="bg-muted rounded-2xl rounded-tl-md px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="font-body">Sedang mengetik...</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-2">
        <button onClick={() => setShowHistory(true)}
          className="shrink-0 w-10 h-10 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Riwayat">
          <Clock className="w-4 h-4" />
        </button>
        {messages.length > 0 && (
          <button onClick={onNewConversation}
            className="shrink-0 w-10 h-10 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Percakapan baru">
            <Plus className="w-4 h-4" />
          </button>
        )}
        <div className="flex-1 relative">
          <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Ketik pertanyaan..." rows={1}
            className="w-full px-4 py-3 pr-12 rounded-xl border border-input bg-background text-foreground font-body text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          <button onClick={() => handleSend()} disabled={isLoading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-accent-foreground hover:brightness-110 transition-all disabled:opacity-30">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

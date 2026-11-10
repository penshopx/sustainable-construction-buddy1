import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import type { PakarMode } from "@/pages/HelpdeskAI";
import type { TablesInsert } from "@/integrations/supabase/types";

export type Msg = { role: "user" | "assistant"; content: string };

export type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/helpdesk-chat`;

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return fallback;
};

const getStreamContent = (value: unknown): string | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const choices = (value as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return undefined;
  const delta = (choices[0] as { delta?: unknown }).delta;
  if (!delta || typeof delta !== "object") return undefined;
  const content = (delta as { content?: unknown }).content;
  return typeof content === "string" ? content : undefined;
};

type ChatRequestBody = {
  messages: Msg[];
  mode: PakarMode;
  custom_persona?: string;
};

export function useHelpdeskChat(
  mode: PakarMode = "pembelajaran",
  customPersona?: string,
  chatbotId?: string
) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    setLoadingConversations(true);
    const { data } = await supabase
      .from("helpdesk_conversations")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    setConversations(data || []);
    setLoadingConversations(false);
  }, [user]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const loadMessages = useCallback(async (conversationId: string) => {
    const { data } = await supabase
      .from("helpdesk_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    setMessages((data || []).flatMap(({ role, content }) =>
      (role === "user" || role === "assistant") ? [{ role, content }] : []
    ));
  }, []);

  const selectConversation = useCallback(async (id: string) => {
    setActiveConversationId(id);
    await loadMessages(id);
  }, [loadMessages]);

  const startNewConversation = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    await supabase.from("helpdesk_conversations").delete().eq("id", id);
    if (activeConversationId === id) {
      setActiveConversationId(null);
      setMessages([]);
    }
    await loadConversations();
  }, [activeConversationId, loadConversations]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading || !user) return;

    const userMsg: Msg = { role: "user", content: text.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setIsLoading(true);

    let conversationId = activeConversationId;

    try {
      if (!conversationId) {
        const title = text.trim().slice(0, 80);
        const insertData: TablesInsert<"helpdesk_conversations"> = { user_id: user.id, title };
        if (chatbotId) insertData.chatbot_id = chatbotId;
        const { data: conv, error: convError } = await supabase
          .from("helpdesk_conversations")
          .insert(insertData)
          .select()
          .single();
        if (convError || !conv) throw new Error("Gagal membuat percakapan");
        conversationId = conv.id;
        setActiveConversationId(conversationId);
      } else {
        await supabase
          .from("helpdesk_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversationId);
      }

      await supabase.from("helpdesk_messages").insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: "user",
        content: text.trim(),
      });

      // Stream AI response with mode and optional custom persona
      let assistantSoFar = "";
      const body: ChatRequestBody = { messages: allMessages, mode };
      if (customPersona) body.custom_persona = customPersona;

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const response: unknown = await resp.json().catch(() => null);
        const error = response && typeof response === "object" ? (response as { error?: unknown }).error : undefined;
        throw new Error(typeof error === "string" ? error : "Gagal menghubungi AI");
      }
      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed: unknown = JSON.parse(jsonStr);
            const content = getStreamContent(parsed);
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Flush remaining
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed: unknown = JSON.parse(jsonStr);
            const content = getStreamContent(parsed);
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch { /* ignore */ }
        }
      }

      if (assistantSoFar && conversationId) {
        await supabase.from("helpdesk_messages").insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: "assistant",
          content: assistantSoFar,
        });
      }

      await loadConversations();
    } catch (error: unknown) {
      toast({ title: "Error", description: getErrorMessage(error, "Gagal mengirim pesan"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, user, activeConversationId, loadConversations, mode, customPersona, chatbotId]);

  return {
    conversations,
    activeConversationId,
    messages,
    isLoading,
    loadingConversations,
    sendMessage,
    selectConversation,
    startNewConversation,
    deleteConversation,
    setMessages,
  };
}

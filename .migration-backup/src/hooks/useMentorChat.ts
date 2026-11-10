import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/sonner-toast";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type MentorType = "learning" | "expert" | "project";
export type Msg = { role: "user" | "assistant"; content: string };

export type KnowledgeBase = Tables<"mentor_knowledge_bases">;

export type MentorConversation = Tables<"mentor_conversations">;

export type ExternalBot = Tables<"mentor_external_bots">;

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

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mentor-chat`;
const EXTRACT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mentor-extract`;

export function useMentorChat(mentorType: MentorType) {
  const { user } = useAuth();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKbId, setSelectedKbId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<MentorConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [externalBots, setExternalBots] = useState<ExternalBot[]>([]);
  const [selectedExpertBotId, setSelectedExpertBotId] = useState<string>("orchestrator");

  const loadKnowledgeBases = useCallback(async () => {
    if (!user) return;
    const kbType = mentorType === "project" ? "project_brain" : "learning";
    const { data } = await supabase
      .from("mentor_knowledge_bases")
      .select("*")
      .eq("user_id", user.id)
      .eq("type", kbType)
      .order("created_at", { ascending: false });
    setKnowledgeBases(data || []);
  }, [user, mentorType]);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("mentor_conversations")
      .select("*")
      .eq("user_id", user.id)
      .eq("mentor_type", mentorType)
      .order("updated_at", { ascending: false });
    setConversations(data || []);
  }, [user, mentorType]);

  const loadExternalBots = useCallback(async () => {
    if (mentorType !== "expert") return;
    const { data } = await supabase
      .from("mentor_external_bots")
      .select("*")
      .order("created_at", { ascending: false });
    setExternalBots(data || []);
  }, [mentorType]);

  useEffect(() => {
    loadKnowledgeBases();
    loadConversations();
    loadExternalBots();
  }, [loadKnowledgeBases, loadConversations, loadExternalBots]);

  const uploadKnowledgeBase = useCallback(async (file: File, title: string, description: string, projectId?: string) => {
    if (!user) return;
    const kbType = mentorType === "project" ? "project_brain" : "learning";
    const filePath = `${user.id}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("mentor-uploads")
      .upload(filePath, file);
    if (uploadError) { toast.error("Gagal upload file"); return; }

    const { data: urlData } = supabase.storage.from("mentor-uploads").getPublicUrl(filePath);

    const { data: kb, error: kbError } = await supabase
      .from("mentor_knowledge_bases")
      .insert({
        user_id: user.id,
        type: kbType,
        title,
        description,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        project_id: projectId || null,
      } satisfies TablesInsert<"mentor_knowledge_bases">)
      .select()
      .single();

    if (kbError || !kb) { toast.error("Gagal menyimpan knowledge base"); return; }

    // Trigger extraction
    toast.info("Memproses dokumen...");
    try {
      const session = await supabase.auth.getSession();
      const resp = await fetch(EXTRACT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.data.session?.access_token}`,
        },
        body: JSON.stringify({ knowledgeBaseId: kb.id }),
      });
      const result: unknown = await resp.json();
      if (result && typeof result === "object" && (result as { success?: unknown }).success === true) {
        const chunkCount = (result as { chunkCount?: unknown }).chunkCount;
        toast.success(`Dokumen diproses: ${typeof chunkCount === "number" ? chunkCount : 0} chunk`);
      } else {
        const error = result && typeof result === "object" ? (result as { error?: unknown }).error : undefined;
        toast.error(typeof error === "string" ? error : "Gagal memproses dokumen");
      }
    } catch {
      toast.error("Gagal memproses dokumen");
    }

    await loadKnowledgeBases();
  }, [user, mentorType, loadKnowledgeBases]);

  const deleteKnowledgeBase = useCallback(async (id: string) => {
    await supabase.from("mentor_knowledge_bases").delete().eq("id", id);
    if (selectedKbId === id) setSelectedKbId(null);
    await loadKnowledgeBases();
  }, [selectedKbId, loadKnowledgeBases]);

  const selectConversation = useCallback(async (id: string) => {
    setActiveConversationId(id);
    const { data } = await supabase
      .from("mentor_messages")
      .select("role, content")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });
    setMessages((data || []).flatMap(({ role, content }) =>
      (role === "user" || role === "assistant") ? [{ role, content }] : []
    ));
  }, []);

  const startNewConversation = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    await supabase.from("mentor_conversations").delete().eq("id", id);
    if (activeConversationId === id) { setActiveConversationId(null); setMessages([]); }
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
        const { data: conv, error: convError } = await supabase
          .from("mentor_conversations")
          .insert({
            user_id: user.id,
            mentor_type: mentorType,
            title: text.trim().slice(0, 80),
            knowledge_base_id: selectedKbId,
            project_id: selectedProjectId,
          })
          .select()
          .single();
        if (convError || !conv) throw new Error("Gagal membuat percakapan");
        conversationId = conv.id;
        setActiveConversationId(conversationId);
      } else {
        await supabase
          .from("mentor_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversationId);
      }

      await supabase.from("mentor_messages").insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: "user",
        content: text.trim(),
      });

      // Stream AI response
      const session = await supabase.auth.getSession();
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.data.session?.access_token}`,
        },
        body: JSON.stringify({
          messages: allMessages,
          mentorType,
          knowledgeBaseId: selectedKbId,
          projectId: selectedProjectId,
          expertBotId: mentorType === "expert" ? selectedExpertBotId : undefined,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Gagal menghubungi AI" }));
        throw new Error(err.error || `Error ${resp.status}`);
      }
      if (!resp.body) throw new Error("No response body");

      let assistantSoFar = "";
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
        await supabase.from("mentor_messages").insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: "assistant",
          content: assistantSoFar,
        });
      }

      await loadConversations();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Gagal mengirim pesan"));
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, user, activeConversationId, mentorType, selectedKbId, selectedProjectId, selectedExpertBotId, loadConversations]);

  // External bot CRUD
  const addExternalBot = useCallback(async (bot: Omit<ExternalBot, "id" | "is_active" | "user_id" | "created_at" | "updated_at">) => {
    if (!user) return;
    await supabase.from("mentor_external_bots").insert({ ...bot, user_id: user.id } satisfies TablesInsert<"mentor_external_bots">);
    await loadExternalBots();
  }, [user, loadExternalBots]);

  const deleteExternalBot = useCallback(async (id: string) => {
    await supabase.from("mentor_external_bots").delete().eq("id", id);
    await loadExternalBots();
  }, [loadExternalBots]);

  return {
    knowledgeBases, selectedKbId, setSelectedKbId,
    selectedProjectId, setSelectedProjectId,
    conversations, activeConversationId,
    messages, isLoading,
    externalBots,
    selectedExpertBotId, setSelectedExpertBotId,
    uploadKnowledgeBase, deleteKnowledgeBase,
    sendMessage, selectConversation, startNewConversation, deleteConversation,
    addExternalBot, deleteExternalBot,
    setMessages,
  };
}

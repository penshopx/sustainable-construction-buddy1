import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import type { PakarMode } from "@/pages/HelpdeskAI";
import type { TablesInsert } from "@/integrations/supabase/types";
import { sendHelpdeskMessage, type ChatEngine, type ChatMessage } from "@workspace/api-client-react";
import { vaultCitationText } from "@/lib/vault-citations";
import { clinicPrefix } from "@/lib/clinicScope";
import { helpdeskContext } from "@/lib/chatEngines";
import { profileTitle, restoreProfile, type SchemeProfile } from "@/lib/schemeChat";

export type Msg = ChatMessage;
export type Conversation = { id: string; title: string; created_at: string; updated_at: string };
class HelpdeskError extends Error {}

export function useHelpdeskChat(
  mode: PakarMode = "pembelajaran",
  customPersona?: string,
  chatbotId?: string,
  engine: ChatEngine = "claude",
  schemeProfile?: SchemeProfile,
  onProfileRestore?: (profile?: SchemeProfile) => void,
  useVaultContext = false,
  clinicTopic?: string,
) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [lastModel, setLastModel] = useState("");
  const [lastError, setLastError] = useState<string | null>(null);
  const mounted = useRef(false);
  const operation = useRef(0);
  const contextStart = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const currentUserId = useRef(user?.id);
  currentUserId.current = user?.id;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      operation.current += 1;
      pending.current?.abort();
    };
  }, []);

  const notify = (message: string) => {
    setLastError(message);
    toast({ title: clinicTopic ? "Klinik Konsultasi" : "Pakar Cerdas", description: message, variant: "destructive" });
  };

  const loadConversations = useCallback(async () => {
    if (!user) { setLoadingConversations(false); return; }
    setLoadingConversations(true);
    try {
      let query = supabase.from("helpdesk_conversations").select("*").eq("user_id", user.id);
      if (clinicTopic) query = query.like("title", `${clinicPrefix(clinicTopic)}%`);
      const { data, error } = await query.order("updated_at", { ascending: false });
      if (!mounted.current || currentUserId.current !== user.id) return;
      if (error) throw new Error();
      setConversations(data || []);
    } catch {
      if (mounted.current && currentUserId.current === user.id) notify("Riwayat belum dapat dimuat. Silakan coba lagi.");
    } finally {
      if (mounted.current && currentUserId.current === user.id) setLoadingConversations(false);
    }
  }, [user, clinicTopic]);

  useEffect(() => { void loadConversations(); }, [loadConversations]);

  const startNewConversation = useCallback(() => {
    operation.current += 1;
    pending.current?.abort();
    pending.current = null;
    contextStart.current = 0;
    setIsLoading(false);
    setActiveConversationId(null);
    setMessages([]);
    setLastModel("");
    setLastError(null);
  }, []);

  useEffect(() => {
    startNewConversation();
    setConversations([]);
  }, [user?.id, clinicTopic, startNewConversation]);

  const selectConversation = useCallback(async (id: string) => {
    if (!user) return;
    if (clinicTopic && !conversations.some(row => row.id === id && row.title.startsWith(clinicPrefix(clinicTopic)))) return;
    startNewConversation();
    const version = operation.current;
    setIsLoading(true);
    try {
      const restored = restoreProfile(conversations.find(row => row.id === id)?.title ?? "");
      const { data, error } = await supabase.from("helpdesk_messages")
        .select("role, content").eq("conversation_id", id).eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (!mounted.current || operation.current !== version) return;
      if (error) throw new Error();
      const loaded = (data || []).flatMap(({ role, content }): Msg[] =>
        role === "user" || role === "assistant" ? [{ role, content }] : []);
      setActiveConversationId(id);
      setMessages(loaded);
      onProfileRestore?.(restored);
      // Historical records predate engine metadata. Display them, but never
      // automatically transfer their contents to a potentially different model.
      contextStart.current = loaded.length;
    } catch {
      if (mounted.current && operation.current === version) notify("Isi riwayat atau profil belum dapat dimuat. Pilih skema dan mulai percakapan baru.");
    } finally {
      if (mounted.current && operation.current === version) setIsLoading(false);
    }
  }, [user, startNewConversation, conversations, onProfileRestore, clinicTopic]);

  const deleteConversation = useCallback(async (id: string) => {
    if (!user) return;
    if (activeConversationId === id) startNewConversation();
    const { error } = await supabase.from("helpdesk_conversations").delete()
      .eq("id", id).eq("user_id", user.id);
    if (!mounted.current) return;
    if (error) { notify("Percakapan belum berhasil dihapus."); return; }
    await loadConversations();
  }, [user, activeConversationId, loadConversations, startNewConversation]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading || pending.current || !user) return;
    if (text.trim().length > 4000) { notify("Pertanyaan maksimal 4000 karakter."); return; }
    const version = ++operation.current;
    const controller = new AbortController();
    pending.current = controller;
    const active = () => mounted.current && operation.current === version && !controller.signal.aborted;
    const userMsg: Msg = { role: "user", content: text.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setIsLoading(true);
    setLastError(null);
    let conversationId = activeConversationId;
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (!active()) return;
      if (sessionError || !session?.access_token || session.user.id !== user.id) {
        throw new HelpdeskError("Sesi tidak valid. Silakan login kembali.");
      }
      if (!conversationId) {
        const row: TablesInsert<"helpdesk_conversations"> = {
          user_id: user.id, title: `${clinicPrefix(clinicTopic)}${profileTitle(schemeProfile)}[${engine}] ${text.trim().slice(0, 65)}`,
          ...(chatbotId ? { chatbot_id: chatbotId } : {}),
        };
        const { data, error } = await supabase.from("helpdesk_conversations").insert(row).select().single();
        if (!active()) return;
        if (error || !data) throw new HelpdeskError("Percakapan belum dapat dibuat.");
        conversationId = data.id;
        setActiveConversationId(conversationId);
      }
      const { error: saveUserError } = await supabase.from("helpdesk_messages").insert({
        conversation_id: conversationId, user_id: user.id, role: "user", content: userMsg.content,
      });
      if (!active()) return;
      if (saveUserError) throw new HelpdeskError("Pesan belum tersimpan. Jawaban AI belum diminta.");
      const result = await sendHelpdeskMessage({
        messages: helpdeskContext(allMessages.slice(contextStart.current)),
        engine, mode, ...(customPersona ? { custom_persona: customPersona.slice(0, 6000) } : {}),
        ...(schemeProfile ?? {}),
        use_vault_context: useVaultContext,
      }, { headers: { Authorization: `Bearer ${session.access_token}` }, signal: controller.signal });
      if (!active()) return;
      if (result.reply?.trim() && result.vault_sources?.length) {
        result.reply += vaultCitationText(result.vault_sources);
      }
      if (!result.reply?.trim() || result.engine !== engine ||
        (schemeProfile && result.scheme_code !== schemeProfile.scheme_code)) {
        throw new HelpdeskError("Jawaban AI tidak valid. Tidak ada model pengganti yang dipanggil.");
      }
      setMessages([...allMessages, { role: "assistant", content: result.reply }]);
      setLastModel(result.model || engine);
      const { error: saveReplyError } = await supabase.from("helpdesk_messages").insert({
        conversation_id: conversationId, user_id: user.id, role: "assistant", content: result.reply,
      });
      if (!active()) return;
      if (saveReplyError) throw new HelpdeskError("Jawaban tampil, tetapi belum tersimpan dalam riwayat. Salin jawaban sebelum meninggalkan halaman.");
      const { error: updateError } = await supabase.from("helpdesk_conversations")
        .update({ updated_at: new Date().toISOString() }).eq("id", conversationId).eq("user_id", user.id);
      if (!active()) return;
      if (updateError) notify("Jawaban tersimpan, tetapi urutan riwayat belum diperbarui.");
      await loadConversations();
    } catch (error) {
      if (active()) {
        // Generated API errors expose only the server's sanitized message.
        const data = error && typeof error === "object" && "data" in error ? error.data : null;
        const serverMessage = data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : null;
        notify(serverMessage || (error instanceof HelpdeskError ? error.message : "Gagal mengirim pesan. Silakan periksa koneksi dan coba lagi."));
      }
    } finally {
      if (active()) { pending.current = null; setIsLoading(false); }
    }
  }, [messages, isLoading, user, activeConversationId, loadConversations, mode, customPersona, chatbotId, engine, schemeProfile, useVaultContext, clinicTopic]);

  return { conversations, activeConversationId, messages, isLoading, loadingConversations,
    sendMessage, selectConversation, startNewConversation, deleteConversation, setMessages, lastModel, lastError };
}

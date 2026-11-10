import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/sonner-toast";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { freshSmapFileUrl, smapStoragePath } from "@/lib/smapFileAccess";

export type SmapDocument = Tables<"smap_documents">;

export type SmapDocType = "surat_pernyataan" | "sertifikat_iso" | "pendidikan_antikorupsi";

export function useSmapDocuments(docType?: SmapDocType) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<SmapDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const identity = useRef(user?.id);
  identity.current = user?.id;

  const fetchDocuments = useCallback(async () => {
    if (!user) { setDocuments([]); setLoading(false); return; }
    const ownerId = user.id;
    setLoading(true);
    let query = supabase.from("smap_documents")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (docType) {
      query = query.eq("doc_type", docType);
    }
    const { data, error } = await query;
    if (identity.current !== ownerId) return;
    if (error) {
      console.error("Error fetching smap docs:", error);
    } else {
      setDocuments(data || []);
    }
    setLoading(false);
  }, [user, docType]);

  useEffect(() => {
    identity.current = user?.id;
    void fetchDocuments();
    return () => { identity.current = undefined; };
  }, [fetchDocuments]);

  const saveDocument = async (doc: Partial<SmapDocument> & { doc_type: string }) => {
    if (!user) return;
    const { id, ...document } = doc;
    if (document.file_url) {
      try {
        document.file_url = smapStoragePath(document.file_url, import.meta.env.VITE_SUPABASE_URL, user.id, id || "");
      } catch {
        toast.error("Lokasi berkas tidak valid.");
        return null;
      }
    }

    if (id) {
      const payload: TablesUpdate<"smap_documents"> = { ...document, user_id: user.id };
      const { error } = await supabase.from("smap_documents")
        .update(payload)
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) { toast.error("Gagal menyimpan: " + error.message); return null; }
    } else {
      const payload: TablesInsert<"smap_documents"> = { ...document, user_id: user.id };
      const { data, error } = await supabase.from("smap_documents")
        .insert(payload)
        .select()
        .single();
      if (error) { toast.error("Gagal membuat: " + error.message); return null; }
      toast.success("Dokumen berhasil disimpan");
      fetchDocuments();
      return data;
    }
    toast.success("Dokumen berhasil diperbarui");
    fetchDocuments();
    return true;
  };

  const deleteDocument = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("smap_documents")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) { toast.error("Gagal menghapus: " + error.message); return; }
    toast.success("Dokumen dihapus");
    fetchDocuments();
  };

  const uploadFile = async (file: File, docId: string) => {
    if (!user) return null;
    const ownerId = user.id;
    const fileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-160) || "dokumen";
    const path = `${user.id}/${docId}/${crypto.randomUUID()}-${fileName}`;
    try { smapStoragePath(path, import.meta.env.VITE_SUPABASE_URL, ownerId, docId); }
    catch { toast.error("Lokasi berkas tidak valid."); return null; }
    const { error } = await supabase.storage.from("smap-documents").upload(path, file, { upsert: false });
    if (identity.current !== ownerId) return null;
    if (error) { toast.error("Gagal upload: " + error.message); return null; }
    return { url: path, name: file.name };
  };

  const openFile = async (doc: SmapDocument) => {
    if (!user || !doc.file_url) return;
    const ownerId = user.id;
    // Open synchronously to avoid popup blockers after the asynchronous signing call.
    const tab = window.open("about:blank", "_blank");
    if (!tab) { toast.error("Izinkan pop-up untuk membuka berkas."); return; }
    tab.opener = null;
    try {
      const url = await freshSmapFileUrl(doc.file_url, import.meta.env.VITE_SUPABASE_URL, ownerId, doc.id,
        (path, ttl) => supabase.storage.from("smap-documents").createSignedUrl(path, ttl));
      if (identity.current !== ownerId) { tab.close(); return; }
      tab.location.replace(url);
    } catch {
      tab.close();
      toast.error("Berkas belum dapat dibuka. Silakan coba lagi.");
    }
  };

  return { documents, loading, saveDocument, deleteDocument, uploadFile, openFile, refetch: fetchDocuments };
}

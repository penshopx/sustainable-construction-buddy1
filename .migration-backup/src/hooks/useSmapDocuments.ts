import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/sonner-toast";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type SmapDocument = Tables<"smap_documents">;

export type SmapDocType = "surat_pernyataan" | "sertifikat_iso" | "pendidikan_antikorupsi";

export function useSmapDocuments(docType?: SmapDocType) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<SmapDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase.from("smap_documents")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (docType) {
      query = query.eq("doc_type", docType);
    }
    const { data, error } = await query;
    if (error) {
      console.error("Error fetching smap docs:", error);
    } else {
      setDocuments(data || []);
    }
    setLoading(false);
  }, [user, docType]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const saveDocument = async (doc: Partial<SmapDocument> & { doc_type: string }) => {
    if (!user) return;
    const { id, ...document } = doc;

    if (id) {
      const payload: TablesUpdate<"smap_documents"> = { ...document, user_id: user.id };
      const { error } = await supabase.from("smap_documents")
        .update(payload)
        .eq("id", id);
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
    const { error } = await supabase.from("smap_documents")
      .delete()
      .eq("id", id);
    if (error) { toast.error("Gagal menghapus: " + error.message); return; }
    toast.success("Dokumen dihapus");
    fetchDocuments();
  };

  const uploadFile = async (file: File, docId: string) => {
    if (!user) return null;
    const path = `${user.id}/${docId}/${file.name}`;
    const { error } = await supabase.storage.from("smap-documents").upload(path, file, { upsert: true });
    if (error) { toast.error("Gagal upload: " + error.message); return null; }
    const { data: urlData } = await supabase.storage.from("smap-documents").createSignedUrl(path, 60 * 60 * 24 * 365);
    return { url: urlData?.signedUrl || "", name: file.name };
  };

  return { documents, loading, saveDocument, deleteDocument, uploadFile, refetch: fetchDocuments };
}

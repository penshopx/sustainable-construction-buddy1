import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface LkutDocument {
  id: string;
  lkut_id: string;
  user_id: string;
  component: string;
  file_name: string;
  file_url: string;
  file_size: number;
  file_type: string;
  notes: string;
  created_at: string;
}

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

const ACCEPT_STRING = ".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.docx,.doc";

export function useLkutDocuments(lkutId: string | undefined) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<LkutDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchDocs = useCallback(async () => {
    if (!user || !lkutId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("lkut_documents")
      .select("*")
      .eq("lkut_id", lkutId)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Gagal memuat dokumen", description: error.message, variant: "destructive" });
    } else {
      setDocuments(data || []);
    }
    setLoading(false);
  }, [user, lkutId, toast]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const uploadDocument = async (file: File, component: string, notes: string = "") => {
    if (!user || !lkutId) return false;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({ title: "Format tidak didukung", description: "Gunakan PDF, JPG, PNG, Excel, atau Word", variant: "destructive" });
      return false;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "File terlalu besar", description: "Maksimal 20MB per file", variant: "destructive" });
      return false;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${lkutId}/${component}/${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage.from("lkut-documents").upload(path, file);
    if (uploadErr) {
      toast({ title: "Gagal upload", description: uploadErr.message, variant: "destructive" });
      setUploading(false);
      return false;
    }

    const { data: urlData } = supabase.storage.from("lkut-documents").getPublicUrl(path);

    const { error: insertErr } = await supabase.from("lkut_documents").insert({
      lkut_id: lkutId,
      user_id: user.id,
      component,
      file_name: file.name,
      file_url: urlData.publicUrl,
      file_size: file.size,
      file_type: file.type,
      notes,
    });

    if (insertErr) {
      toast({ title: "Gagal menyimpan data dokumen", description: insertErr.message, variant: "destructive" });
      setUploading(false);
      return false;
    }

    toast({ title: "Dokumen berhasil diunggah" });
    await fetchDocs();
    setUploading(false);
    return true;
  };

  const deleteDocument = async (doc: LkutDocument) => {
    // Extract storage path from URL
    const pathMatch = doc.file_url.split("/lkut-documents/").pop();
    if (pathMatch) {
      await supabase.storage.from("lkut-documents").remove([decodeURIComponent(pathMatch)]);
    }

    const { error } = await supabase.from("lkut_documents").delete().eq("id", doc.id);
    if (error) {
      toast({ title: "Gagal menghapus", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Dokumen dihapus" });
    await fetchDocs();
  };

  const getByComponent = (component: string) => documents.filter((d) => d.component === component);

  return { documents, loading, uploading, uploadDocument, deleteDocument, getByComponent, acceptString: ACCEPT_STRING, fetchDocs };
}

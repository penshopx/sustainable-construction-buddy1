import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Loader2 } from "lucide-react";

interface Props {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

type KB = { id: string; title: string; description: string; file_name: string; chunk_count: number; status: string };

export function ChatbotKnowledgeStep({ selectedIds, onSelectionChange }: Props) {
  const { user } = useAuth();
  const [kbs, setKbs] = useState<KB[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("mentor_knowledge_bases")
      .select("id, title, description, file_name, chunk_count, status")
      .eq("user_id", user.id)
      .eq("status", "processed")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setKbs((data as KB[]) || []);
        setLoading(false);
      });
  }, [user]);

  const toggle = (id: string) => {
    onSelectionChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (kbs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Belum ada knowledge base.</p>
        <p className="text-xs mt-1">Upload dokumen di menu Mentor terlebih dahulu.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Pilih knowledge base untuk RAG (opsional):</p>
      {kbs.map((kb) => (
        <label
          key={kb.id}
          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
            selectedIds.includes(kb.id)
              ? "border-primary bg-primary/5"
              : "border-border hover:bg-accent/50"
          }`}
        >
          <Checkbox
            checked={selectedIds.includes(kb.id)}
            onCheckedChange={() => toggle(kb.id)}
            className="mt-0.5"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{kb.title}</p>
            <p className="text-xs text-muted-foreground">{kb.file_name} · {kb.chunk_count} chunks</p>
          </div>
        </label>
      ))}
    </div>
  );
}

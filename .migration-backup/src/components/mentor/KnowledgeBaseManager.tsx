import { useState, useRef } from "react";
import { Upload, FileText, Trash2, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import type { KnowledgeBase } from "@/hooks/useMentorChat";

interface KnowledgeBaseManagerProps {
  knowledgeBases: KnowledgeBase[];
  selectedKbId: string | null;
  onSelect: (id: string | null) => void;
  onUpload: (file: File, title: string, description: string, projectId?: string) => Promise<void>;
  onDelete: (id: string) => void;
  projectId?: string;
  label?: string;
}

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />,
  processing: <Loader2 className="w-4 h-4 animate-spin text-pub-amber" />,
  ready: <CheckCircle className="w-4 h-4 text-green-500" />,
  error: <AlertCircle className="w-4 h-4 text-destructive" />,
};

export default function KnowledgeBaseManager({
  knowledgeBases, selectedKbId, onSelect, onUpload, onDelete, projectId, label = "Knowledge Base",
}: KnowledgeBaseManagerProps) {
  const [showUpload, setShowUpload] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  const handleUpload = async () => {
    if (!file || !title.trim()) return;
    setUploading(true);
    await onUpload(file, title.trim(), description.trim(), projectId);
    setUploading(false);
    setShowUpload(false);
    setTitle("");
    setDescription("");
    setFile(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-heading font-semibold text-foreground">{label}</h4>
        <button onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:brightness-110">
          <Upload className="w-3.5 h-3.5" /> Upload
        </button>
      </div>

      {showUpload && (
        <div className="p-3 rounded-xl border border-border bg-muted/50 space-y-2">
          <input type="text" placeholder="Judul modul/dokumen" value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground" />
          <input type="text" placeholder="Deskripsi (opsional)" value={description} onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground" />
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.doc,.docx" className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <button onClick={() => fileRef.current?.click()}
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:bg-muted">
              <FileText className="w-4 h-4" />
              {file ? file.name : "Pilih file (PDF, TXT, MD, DOC)"}
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={handleUpload} disabled={uploading || !file || !title.trim()}
              className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Upload & Proses"}
            </button>
            <button onClick={() => { setShowUpload(false); setFile(null); }}
              className="px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted">Batal</button>
          </div>
        </div>
      )}

      {knowledgeBases.length === 0 && !showUpload && (
        <p className="text-xs text-muted-foreground text-center py-4">Belum ada dokumen. Upload untuk memulai.</p>
      )}

      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {knowledgeBases.map(kb => (
          <div key={kb.id}
            className={`flex flex-col gap-1 p-2.5 rounded-xl cursor-pointer transition-colors ${
              kb.id === selectedKbId ? "bg-primary/10 border border-primary/20" : "hover:bg-muted border border-transparent"
            }`}
            onClick={() => kb.status === "ready" && onSelect(kb.id === selectedKbId ? null : kb.id)}>
            <div className="flex items-center gap-2">
              {statusIcons[kb.status] || statusIcons.pending}
              <p className="text-sm font-medium truncate text-foreground flex-1">{kb.title}</p>
              <button onClick={(e) => { e.stopPropagation(); onDelete(kb.id); }}
                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground pl-6">{kb.file_name} • {kb.chunk_count} chunk</p>
          </div>
        ))}
      </div>
    </div>
  );
}

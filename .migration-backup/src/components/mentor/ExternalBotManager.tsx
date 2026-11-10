import { useState } from "react";
import { ExternalLink, Plus, Trash2, Bot, Link } from "lucide-react";
import type { ExternalBot } from "@/hooks/useMentorChat";

interface ExternalBotManagerProps {
  bots: ExternalBot[];
  onAdd: (bot: { name: string; description: string; url: string; icon: string }) => void;
  onDelete: (id: string) => void;
}

export default function ExternalBotManager({ bots, onAdd, onDelete }: ExternalBotManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");

  const handleAdd = () => {
    if (!name.trim() || !url.trim()) return;
    onAdd({ name: name.trim(), description: description.trim(), url: url.trim(), icon: "Bot" });
    setShowForm(false);
    setName("");
    setDescription("");
    setUrl("");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-heading font-semibold text-foreground">Chatbot Eksternal</h4>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:brightness-110">
          <Plus className="w-3.5 h-3.5" /> Tambah
        </button>
      </div>

      {showForm && (
        <div className="p-3 rounded-xl border border-border bg-muted/50 space-y-2">
          <input type="text" placeholder="Nama chatbot" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground" />
          <input type="text" placeholder="Deskripsi (opsional)" value={description} onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground" />
          <input type="url" placeholder="URL chatbot" value={url} onChange={(e) => setUrl(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground" />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={!name.trim() || !url.trim()}
              className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40">Simpan</button>
            <button onClick={() => setShowForm(false)}
              className="px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted">Batal</button>
          </div>
        </div>
      )}

      {bots.length === 0 && !showForm && (
        <p className="text-xs text-muted-foreground text-center py-4">Belum ada chatbot eksternal.</p>
      )}

      <div className="space-y-1.5">
        {bots.map(bot => (
          <div key={bot.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-border hover:bg-muted transition-colors">
            <Bot className="w-4 h-4 text-pub-amber shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-foreground">{bot.name}</p>
              {bot.description && <p className="text-xs text-muted-foreground truncate">{bot.description}</p>}
            </div>
            <a href={bot.url} target="_blank" rel="noopener noreferrer"
              className="p-1.5 rounded-lg hover:bg-primary/10 text-primary">
              <ExternalLink className="w-4 h-4" />
            </a>
            <button onClick={() => onDelete(bot.id)}
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

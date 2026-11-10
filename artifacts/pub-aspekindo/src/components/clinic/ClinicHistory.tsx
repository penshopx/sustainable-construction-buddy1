import { History, Loader2, MessageSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Conversation } from "@/hooks/useHelpdeskChat";
import { clinicConversationTitle } from "@/lib/clinicScope";
import { formatClinicDate } from "./clinicUi";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  loading: boolean;
  busy: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export default function ClinicHistory({ conversations, activeId, loading, busy, onSelect, onNew, onDelete }: Props) {
  return (
    <section aria-labelledby="hist-title" className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-3">
        <h2 id="hist-title" className="flex items-center gap-2 text-sm font-semibold"><History className="h-4 w-4 text-pub-sky" /> Riwayat loket</h2>
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={onNew} disabled={busy} data-testid="button-new-conversation"><Plus className="h-3.5 w-3.5" /> Baru</Button>
      </div>
      <div className="max-h-72 overflow-y-auto p-2">
        {loading ? (
          <div className="flex justify-center p-4 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-label="Memuat riwayat" /></div>
        ) : conversations.length === 0 ? (
          <p className="p-3 text-center text-xs text-muted-foreground">Belum ada percakapan di loket ini.</p>
        ) : (
          <ul className="space-y-1">
            {conversations.map(c => (
              <li key={c.id} className={`group flex items-center gap-1 rounded-lg ${c.id === activeId ? "bg-primary/10" : "hover:bg-accent/50"}`}>
                <button type="button" disabled={busy} onClick={() => onSelect(c.id)} data-testid={`button-conversation-${c.id}`}
                  className="flex min-w-0 flex-1 items-start gap-2 p-2 text-left disabled:opacity-60">
                  <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{clinicConversationTitle(c.title) || "Percakapan"}</span>
                    <span className="block text-[11px] text-muted-foreground">{formatClinicDate(c.updated_at)}</span>
                  </span>
                </button>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label="Hapus percakapan" data-testid={`button-delete-conversation-${c.id}`}
                  onClick={() => { if (window.confirm("Hapus percakapan ini dari riwayat?")) onDelete(c.id); }}>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

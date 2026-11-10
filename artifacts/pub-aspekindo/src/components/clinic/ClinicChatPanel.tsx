import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import type { Msg } from "@/hooks/useHelpdeskChat";
import type { ClinicTopic } from "@/lib/clinicCatalog";
import { DeskNumber } from "./clinicUi";

interface Props {
  topic: ClinicTopic;
  messages: Msg[];
  isLoading: boolean;
  lastError: string | null;
  lastModel: string;
  canSend: boolean;
  onSend: (text: string) => void;
}

export default function ClinicChatPanel({ topic, messages, isLoading, lastError, lastModel, canSend, onSend }: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages, isLoading]);

  const submit = () => {
    const text = input.trim();
    if (!text || !canSend || isLoading) return;
    onSend(text);
    setInput("");
  };

  return (
    <section aria-label={`Chat ${topic.name}`} className="flex min-h-[520px] flex-col overflow-hidden rounded-xl border border-border bg-card lg:h-[calc(100dvh-260px)]">
      <div className="flex items-center gap-3 border-b border-border bg-pub-navy/[0.03] px-4 py-3">
        <DeskNumber value={topic.number} />
        <div className="min-w-0">
          <p className="truncate font-heading font-semibold">{topic.name}</p>
          <p className="text-xs text-muted-foreground">Claude Sonnet{lastModel ? ` · jawaban terakhir: ${lastModel}` : ""}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="mx-auto flex max-w-xl flex-col items-start gap-4 py-4">
            <p className="text-sm text-muted-foreground">{topic.description}</p>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contoh pertanyaan, kirim dengan klik</p>
            <div className="grid w-full gap-2">
              {topic.starters.map((s, i) => (
                <button key={i} type="button" disabled={!canSend || isLoading} onClick={() => onSend(s)} data-testid={`button-starter-${i}`}
                  className="rounded-lg border border-border px-3 py-2.5 text-left text-sm transition-colors hover:border-pub-amber/50 hover:bg-pub-amber/5 disabled:cursor-not-allowed disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>
            {!canSend && <p className="text-xs text-pub-amber">Centang persetujuan di atas sebelum mengirim pertanyaan.</p>}
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] rounded-xl px-4 py-3 ${m.role === "user" ? "bg-primary text-primary-foreground" : "border border-border bg-muted/40"}`}>
                  {m.role === "assistant" ? <MarkdownRenderer>{m.content}</MarkdownRenderer> : <p className="whitespace-pre-wrap text-sm">{m.content}</p>}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Menunggu jawaban...</div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {lastError && (
        <div role="alert" data-testid="text-chat-error" className="mx-4 mb-2 flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{lastError} Jawaban AI belum tersedia; Anda dapat mencoba lagi nanti atau menulis permintaan ke operator.</span>
        </div>
      )}

      <form className="flex gap-2 border-t border-border p-3" onSubmit={e => { e.preventDefault(); submit(); }}>
        <label htmlFor="clinic-input" className="sr-only">Pertanyaan</label>
        <Textarea id="clinic-input" data-testid="input-chat" rows={2} value={input} maxLength={4000} disabled={isLoading || !canSend}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder={canSend ? "Tulis pertanyaan Anda (Enter untuk kirim)" : "Setujui pengiriman ke AI eksternal terlebih dahulu"} className="min-h-[44px] flex-1 resize-none" />
        <Button type="submit" size="icon" className="h-auto" aria-label="Kirim" disabled={isLoading || !canSend || !input.trim()} data-testid="button-send">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </section>
  );
}

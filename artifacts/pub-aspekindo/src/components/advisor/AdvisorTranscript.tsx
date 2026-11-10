import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Copy, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import type { Msg } from "@/hooks/useHelpdeskChat";

interface Props {
  title: string; messages: Msg[]; isLoading: boolean; lastError: string | null; lastModel: string;
  empty: React.ReactNode; formatUser?: (t: string) => string; fileName: string;
}

export default function AdvisorTranscript({ title, messages, isLoading, lastError, lastModel, empty, formatUser = t => t, fileName }: Props) {
  const [copied, setCopied] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages.length, isLoading]);
  const lastReply = [...messages].reverse().find(m => m.role === "assistant")?.content;
  const markdown = messages.map(m => `## ${m.role === "user" ? "Pertanyaan" : "Jawaban AI (advisori)"}\n\n${m.role === "user" ? formatUser(m.content) : m.content}`).join("\n\n");

  const copy = async () => {
    if (!lastReply) return;
    try { await navigator.clipboard.writeText(lastReply); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([`# ${title}\n\n> Hasil AI bersifat advisori, bukan keputusan resmi.\n\n${markdown}\n`], { type: "text/markdown" }));
    const a = document.createElement("a"); a.href = url; a.download = fileName; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <section aria-label={title} className="flex min-h-[420px] min-w-0 max-w-full flex-col overflow-hidden rounded-xl border-2 border-border bg-card [overflow-wrap:anywhere]">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-pub-navy px-4 py-3 text-white">
        <div>
          <h2 className="font-heading text-base font-bold">{title}</h2>
          <p className="text-xs text-white/80">Advisori AI · Claude Sonnet{lastModel ? ` · ${lastModel}` : ""}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" disabled={!lastReply} onClick={() => { void copy(); }} data-testid="button-copy-reply">
            {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}{copied ? "Tersalin" : "Salin jawaban"}
          </Button>
          <Button size="sm" variant="secondary" disabled={messages.length === 0} onClick={download} data-testid="button-download-md">
            <Download className="mr-1 h-4 w-4" /> Unduh .md
          </Button>
        </div>
      </header>
      <div className="max-h-[70dvh] min-w-0 flex-1 space-y-4 overflow-x-auto overflow-y-auto p-4" aria-live="polite" aria-busy={isLoading}>
        {messages.length === 0 && !isLoading ? empty : messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "ml-auto max-w-[90%] rounded-xl bg-primary px-4 py-3 text-primary-foreground" : "max-w-full rounded-xl border border-border bg-background px-4 py-3"}>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider opacity-80">{m.role === "user" ? "Anda" : "AI · advisori"}</p>
            {m.role === "assistant" ? <MarkdownRenderer>{m.content}</MarkdownRenderer> : <p className="whitespace-pre-wrap text-sm">{formatUser(m.content)}</p>}
          </div>
        ))}
        {isLoading && <p className="flex items-center gap-2 text-sm font-medium text-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Memproses, mohon tunggu...</p>}
        <div ref={end} />
      </div>
      {lastError && (
        <div role="alert" data-testid="text-advisor-error" className="m-3 flex gap-2 rounded-lg border-2 border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{lastError} Tahap tidak berpindah; Anda dapat mencoba kirim ulang.</span>
        </div>
      )}
    </section>
  );
}

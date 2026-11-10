import { useState } from "react";
import { BrainCircuit, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHelpdeskChat } from "@/hooks/useHelpdeskChat";
import ClinicHistory from "@/components/clinic/ClinicHistory";
import VaultReferencePanel from "@/components/VaultReferencePanel";
import AiConsentBox from "@/components/advisor/AiConsentBox";
import AdvisorTranscript from "@/components/advisor/AdvisorTranscript";
import FollowUpComposer from "@/components/advisor/FollowUpComposer";
import { BRAIN_PERSONA, BRAIN_TOPIC } from "@/lib/brainProject";

const LIMIT = 4000;

export default function BrainAiWorkspace({ prompt, hasFacts }: { prompt: string; hasFacts: boolean }) {
  const [consent, setConsent] = useState(false);
  const [useVault, setUseVault] = useState(false);
  const [restoredId, setRestoredId] = useState<string | null>(null);
  const chat = useHelpdeskChat("profesi", BRAIN_PERSONA, undefined, "claude", undefined, undefined, consent && useVault, BRAIN_TOPIC);
  const resetConsent = () => { setConsent(false); setUseVault(false); };
  const tooLong = prompt.length > LIMIT;
  const started = chat.messages.length > 0;
  const restored = restoredId !== null && restoredId === chat.activeConversationId;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-4">
        <AiConsentBox idPrefix="brain" consent={consent} useVault={useVault} busy={chat.isLoading} onConsent={setConsent} onVault={setUseVault} />
        {!started && (
          <div className="rounded-xl border-2 border-pub-navy bg-pub-navy/[0.04] p-4">
            <p className="text-sm font-medium">Satu permintaan AI, satu analisis dengan enam sudut pandang. Tidak ada agen paralel atau pemantauan otomatis; analisis hanya dibuat saat Anda menekan tombol.</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button size="lg" className="h-auto min-h-11 max-w-full whitespace-normal" disabled={!consent || !hasFacts || tooLong || chat.isLoading} onClick={() => { void chat.sendMessage(prompt); }} data-testid="button-run-analysis">
                {chat.isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BrainCircuit className="mr-2 h-4 w-4" />} Analisis proyek dengan AI
              </Button>
              <span className={`font-mono text-xs ${tooLong ? "font-bold text-destructive" : "text-muted-foreground"}`}>{prompt.length}/{LIMIT} karakter</span>
            </div>
            {!hasFacts && <p className="mt-2 text-sm text-pub-amber">Isi minimal masalah atau pertanyaan utama.</p>}
            {!consent && hasFacts && <p className="mt-2 text-sm text-pub-amber">Centang persetujuan sesi terlebih dahulu.</p>}
            {tooLong && <p className="mt-2 text-sm font-semibold text-destructive">Ringkas isian Anda agar di bawah {LIMIT} karakter.</p>}
          </div>
        )}
        <AdvisorTranscript title="Hasil analisis Brain Project" fileName="brain-project-analisis.md" messages={chat.messages} isLoading={chat.isLoading}
          lastError={chat.lastError} lastModel={chat.lastModel}
          empty={<p className="text-sm text-muted-foreground">Hasil analisis akan tampil di sini. Anda juga dapat membuka riwayat analisis di samping.</p>} />
        {restored && <p role="status" className="rounded-lg border border-border p-3 text-sm">Riwayat ini hanya untuk dibaca. Mulai percakapan baru dan isi kembali fakta proyek untuk analisis terbaru; isi riwayat tidak dikirim ulang secara otomatis.</p>}
        {started && !restored && (
          <FollowUpComposer id="brain-followup" label="Pertanyaan lanjutan" placeholder="Contoh: rinci opsi percepatan dan dampaknya pada TCPI."
            disabled={!consent} busy={chat.isLoading} onSend={t => chat.sendMessage(t)} />
        )}
        {started && !consent && <p className="text-sm text-pub-amber">Centang persetujuan sesi untuk mengirim pertanyaan lanjutan.</p>}
      </div>
      <aside className="min-w-0 space-y-4">
        <ClinicHistory conversations={chat.conversations} activeId={chat.activeConversationId} loading={chat.loadingConversations} busy={chat.isLoading}
          onNew={() => { resetConsent(); setRestoredId(null); chat.startNewConversation(); }}
          onSelect={id => { resetConsent(); setRestoredId(id); void chat.selectConversation(id); }}
          onDelete={id => { void chat.deleteConversation(id); }} />
        <VaultReferencePanel />
      </aside>
    </div>
  );
}

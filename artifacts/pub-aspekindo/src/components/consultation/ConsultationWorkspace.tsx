import { useMemo, useState } from "react";
import { ClipboardList, History, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useHelpdeskChat } from "@/hooks/useHelpdeskChat";
import ClinicHistory from "@/components/clinic/ClinicHistory";
import VaultReferencePanel from "@/components/VaultReferencePanel";
import AiConsentBox from "@/components/advisor/AiConsentBox";
import AdvisorTranscript from "@/components/advisor/AdvisorTranscript";
import ProfessionPicker from "./ProfessionPicker";
import StageRail from "./StageRail";
import { BLUEPRINT_REQUEST, CONSULT_TOPIC, PROFESSIONS, STAGES, deriveFlow, professionPersona, stripTag, tagQuestion } from "@/lib/consultationFlow";

const MAX = 3400;

export default function ConsultationWorkspace() {
  const [picked, setPicked] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [useVault, setUseVault] = useState(false);
  const [restoredId, setRestoredId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const pickedProf = PROFESSIONS.find(p => p.id === picked);
  // Persona is fixed by the derived profession once a session has messages.
  const [personaFor, setPersonaFor] = useState<string | null>(null);
  const personaProf = PROFESSIONS.find(p => p.id === personaFor) ?? pickedProf;
  const chat = useHelpdeskChat("profesi", personaProf ? professionPersona(personaProf) : undefined, undefined, "claude", undefined, undefined, consent && useVault, CONSULT_TOPIC);
  const flow = useMemo(() => deriveFlow(chat.messages), [chat.messages]);
  const profession = PROFESSIONS.find(p => p.id === (flow.professionId ?? picked));
  const restored = restoredId !== null && restoredId === chat.activeConversationId;
  const started = chat.messages.length > 0;
  const allDone = flow.completed.length === 3;
  const readOnly = restored || (started && (!flow.tagged || !profession));
  const stageInfo = STAGES.find(s => s.id === flow.stage)!;

  const reset = () => { setConsent(false); setUseVault(false); setDraft(""); };
  const newSession = (prefill?: string) => {
    reset(); setRestoredId(null); setPersonaFor(null); chat.startNewConversation();
    if (prefill) setDraft(prefill);
  };
  const continueFromHistory = () => {
    const prof = flow.professionId;
    const last = [...chat.messages].reverse().find(m => m.role === "assistant")?.content ?? "";
    newSession(last ? `Lanjutan dari sesi sebelumnya. Ringkasan jawaban terakhir:\n${last.slice(0, 1500)}\n\nSituasi terbaru: ` : "");
    if (prof) setPicked(prof);
  };
  const send = async (text: string) => {
    if (!profession || readOnly || !consent) return;
    setPersonaFor(profession.id);
    await chat.sendMessage(tagQuestion(text, profession.id, flow.stage));
  };
  const submitDraft = async () => {
    const t = draft.trim();
    if (!t) return;
    await send(t);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-5">
        <ProfessionPicker value={profession?.id ?? null} onChange={setPicked} disabled={started || chat.isLoading} />
        {started && <p className="text-sm text-muted-foreground">Peran terkunci untuk sesi ini. Mulai sesi baru untuk mengganti peran.</p>}
        <div>
          <h3 className="mb-3 font-heading text-lg font-bold">2. Ikuti tahapannya</h3>
          <StageRail current={flow.stage} completed={flow.completed} />
        </div>
        <AiConsentBox idPrefix="konsultasi" consent={consent} useVault={useVault} busy={chat.isLoading} onConsent={setConsent} onVault={setUseVault} />

        <AdvisorTranscript title={profession ? `Konsultasi ${profession.name}` : "Konsultasi terpandu"} fileName="konsultasi-blueprint.md"
          messages={chat.messages} isLoading={chat.isLoading} lastError={chat.lastError} lastModel={chat.lastModel} formatUser={stripTag}
          empty={<p className="text-sm text-muted-foreground">Pilih peran, setujui sesi, lalu ceritakan situasi Anda di tahap Diagnosis.</p>} />

        {readOnly ? (
          <div role="status" className="rounded-xl border-2 border-pub-amber bg-pub-amber/10 p-4 text-sm">
            <p className="flex items-center gap-2 font-bold"><History className="h-4 w-4" aria-hidden /> Riwayat ini hanya untuk dibaca.</p>
            <p className="mt-1">AI tidak menerima isi riwayat lama secara otomatis. Lanjutkan di sesi baru: peran dipertahankan dan ringkasan jawaban terakhir disiapkan untuk Anda periksa sebelum dikirim.</p>
            <Button className="mt-3" onClick={continueFromHistory} disabled={chat.isLoading} data-testid="button-continue-new">Lanjutkan di sesi baru</Button>
          </div>
        ) : (
          <section className="space-y-3 rounded-xl border-2 border-border bg-card p-4" aria-labelledby="stage-input">
            <h3 id="stage-input" className="font-heading font-bold">{allDone ? "Blueprint selesai. Pertanyaan lanjutan" : `Tahap ${stageInfo.label}`}</h3>
            <p className="text-sm text-muted-foreground">{allDone ? "Tanyakan rincian blueprint. Tahap tidak berubah lagi." : stageInfo.hint}</p>
            {flow.stage === "blueprint" && !allDone && (
              <div className="rounded-lg border-2 border-primary bg-primary/5 p-3">
                <p className="text-sm font-medium">Permintaan blueprint berisi: ringkasan masalah, tabel prioritas dengan penanggung jawab dan tenggat, bukti vs celah bukti, risiko dan indikator dini, serta asumsi.</p>
                <Button className="mt-3 h-auto min-h-10 max-w-full whitespace-normal" disabled={!consent || chat.isLoading || tagQuestion(`${BLUEPRINT_REQUEST}\n\nCatatan tambahan: ${draft.trim()}`, profession?.id ?? "", flow.stage).length > 4000} onClick={() => { void send(draft.trim() ? `${BLUEPRINT_REQUEST}\n\nCatatan tambahan: ${draft.trim()}` : BLUEPRINT_REQUEST); }} data-testid="button-request-blueprint">
                  {chat.isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardList className="mr-2 h-4 w-4" />} Minta blueprint final
                </Button>
              </div>
            )}
            <label htmlFor="stage-draft" className="sr-only">Isi tahap</label>
            <Textarea id="stage-draft" rows={4} maxLength={MAX} value={draft} disabled={chat.isLoading || !profession} onChange={e => setDraft(e.target.value)} data-testid="input-stage-draft"
              placeholder={!profession ? "Pilih peran terlebih dahulu" : flow.stage === "blueprint" && !allDone ? "Opsional: catatan tambahan untuk blueprint" : "Tulis di sini"} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{draft.length}/{MAX} karakter{!consent ? " · centang persetujuan untuk mengirim" : ""}</span>
              {!(flow.stage === "blueprint" && !allDone) && (
                <Button className="h-auto min-h-10 max-w-full whitespace-normal" disabled={!consent || !profession || !draft.trim() || chat.isLoading} onClick={() => { void submitDraft(); }} data-testid="button-send-stage">
                  {chat.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Kirim ke tahap {allDone ? "lanjutan" : stageInfo.label}
                </Button>
              )}
            </div>
          </section>
        )}
      </div>
      <aside className="min-w-0 space-y-4">
        <ClinicHistory conversations={chat.conversations} activeId={chat.activeConversationId} loading={chat.loadingConversations} busy={chat.isLoading}
          onNew={() => newSession()} onSelect={id => { reset(); setRestoredId(id); void chat.selectConversation(id); }}
          onDelete={id => { void chat.deleteConversation(id); }} />
        <VaultReferencePanel />
      </aside>
    </div>
  );
}

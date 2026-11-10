import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, SearchX, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useHelpdeskChat } from "@/hooks/useHelpdeskChat";
import { getClinicTopic, CLINIC_GROUP_LABEL, type ClinicTopic } from "@/lib/clinicCatalog";
import ClinicChatPanel from "@/components/clinic/ClinicChatPanel";
import ClinicHistory from "@/components/clinic/ClinicHistory";
import ClinicOperatorRequest from "@/components/clinic/ClinicOperatorRequest";
import ClinicPrepTools from "@/components/clinic/ClinicPrepTools";
import { usePageMeta } from "@/components/clinic/clinicUi";
import VaultReferencePanel from "@/components/VaultReferencePanel";

export default function ClinicDesk() {
  const { topicId } = useParams();
  const { user } = useAuth();
  const topic = getClinicTopic(topicId);
  usePageMeta(
    topic ? `${topic.name} | Klinik Konsultasi PUB ASPEKINDO` : "Loket tidak ditemukan | Klinik Konsultasi PUB ASPEKINDO",
    topic ? `Ruang konsultasi ${topic.name}: ${topic.description}` : "Loket Klinik Konsultasi tidak ditemukan.",
  );

  if (!topic) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <SearchX className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 font-heading text-xl font-bold">Loket tidak ditemukan</h1>
        <p className="mt-2 text-sm text-muted-foreground">Alamat loket ini tidak terdaftar di Klinik Konsultasi.</p>
        <Button asChild className="mt-6" data-testid="link-back-directory"><Link to="/klinik-konsultasi">Kembali ke daftar loket</Link></Button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-heading text-xl font-bold">{topic.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Masuk dengan akun PUB untuk berkonsultasi.</p>
        <Button asChild className="mt-6"><Link to={`/auth?next=/klinik-konsultasi/${topic.id}`}>Masuk</Link></Button>
      </div>
    );
  }

  return <DeskWorkspace key={`${user.id}:${topic.id}`} topic={topic} />;
}

function DeskWorkspace({ topic }: { topic: ClinicTopic }) {
  // Both flags start OFF and reset automatically because this component is keyed by account + topic.
  const [consent, setConsent] = useState(false);
  const [useVault, setUseVault] = useState(false);
  const chat = useHelpdeskChat("profesi", topic.persona, undefined, "claude", undefined, undefined, consent && useVault, topic.id);
  const lastQuestion = [...chat.messages].reverse().find(m => m.role === "user")?.content;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/klinik-konsultasi" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" data-testid="link-directory">
            <ArrowLeft className="h-3.5 w-3.5" /> Semua loket
          </Link>
          <h1 className="mt-1 font-heading text-2xl font-bold">{topic.name}</h1>
          <p className="text-xs uppercase tracking-wider text-pub-amber">{CLINIC_GROUP_LABEL[topic.group]}</p>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-pub-amber/30 bg-pub-amber/5 p-3 text-sm">
        <label className="flex gap-3">
          <input type="checkbox" className="mt-1" checked={consent} disabled={chat.isLoading} data-testid="checkbox-ai-consent"
            onChange={e => { setConsent(e.target.checked); if (!e.target.checked) setUseVault(false); }} />
          <span>Saya setuju pesan yang saya kirim di loket ini diproses oleh layanan AI eksternal (Claude Sonnet melalui OpenRouter). Jawaban AI adalah bahan persiapan, bukan keputusan resmi sertifikasi, asesmen, lisensi, atau akreditasi.</span>
        </label>
        <label className={`flex gap-3 ${consent ? "" : "opacity-50"}`}>
          <input type="checkbox" className="mt-1" checked={useVault} disabled={!consent || chat.isLoading} data-testid="checkbox-vault-context"
            onChange={e => setUseVault(e.target.checked)} />
          <span className="flex gap-1">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-pub-emerald" />
            <span>Opsional: gunakan acuan Ruang Simpan. Profil perusahaan milik Anda dan potongan teks dokumen yang relevan akan dikirim ke layanan AI eksternal; berkas utuh tidak dikirim. <a href="/ruang-simpan/" className="text-primary underline">Kelola Ruang Simpan</a></span>
          </span>
        </label>
      </div>

      <VaultReferencePanel />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ClinicChatPanel topic={topic} messages={chat.messages} isLoading={chat.isLoading} lastError={chat.lastError}
          lastModel={chat.lastModel} canSend={consent} onSend={text => { void chat.sendMessage(text); }} />
        <aside className="space-y-4">
          <ClinicHistory conversations={chat.conversations} activeId={chat.activeConversationId} loading={chat.loadingConversations}
            busy={chat.isLoading} onNew={chat.startNewConversation}
            onSelect={id => { void chat.selectConversation(id); }} onDelete={id => { void chat.deleteConversation(id); }} />
          <ClinicOperatorRequest topic={topic} lastQuestion={lastQuestion} />
          <section className="rounded-xl border border-border bg-card p-3">
            <h2 className="mb-1 text-sm font-semibold">Alat persiapan yang sudah ada</h2>
            <ClinicPrepTools compact />
          </section>
        </aside>
      </div>
    </div>
  );
}

import { ShieldCheck } from "lucide-react";

interface Props { consent: boolean; useVault: boolean; busy: boolean; onConsent: (v: boolean) => void; onVault: (v: boolean) => void; idPrefix: string }

export default function AiConsentBox({ consent, useVault, busy, onConsent, onVault, idPrefix }: Props) {
  return (
    <fieldset className="space-y-3 rounded-xl border-2 border-pub-navy/20 bg-card p-4 text-sm">
      <legend className="px-1 font-heading text-sm font-bold">Persetujuan sesi ini</legend>
      <label className="flex gap-3">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" checked={consent} disabled={busy} data-testid={`${idPrefix}-checkbox-ai-consent`}
          onChange={e => { onConsent(e.target.checked); if (!e.target.checked) onVault(false); }} />
        <span className="text-foreground">Saya setuju pesan yang saya kirim di sesi ini diproses layanan AI eksternal (Claude Sonnet melalui OpenRouter). Hasilnya bahan pertimbangan, bukan keputusan resmi sertifikasi, asesmen, lisensi, atau akreditasi.</span>
      </label>
      <label className={`flex gap-3 ${consent ? "" : "opacity-60"}`}>
        <input type="checkbox" className="mt-1 h-4 w-4" checked={useVault} disabled={!consent || busy} data-testid={`${idPrefix}-checkbox-vault`}
          onChange={e => onVault(e.target.checked)} />
        <span className="flex gap-2 text-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-pub-emerald" aria-hidden />
          <span>Opsional: gunakan acuan Ruang Simpan. Profil perusahaan dan potongan teks dokumen yang relevan ikut dikirim; berkas utuh tidak. Metadata dokumen tidak menjamin tersedianya angka proyek. <a href="/ruang-simpan/" className="font-semibold text-primary underline">Kelola Ruang Simpan</a></span>
        </span>
      </label>
      <p className="text-xs text-muted-foreground">Persetujuan berlaku untuk sesi ini saja dan kembali mati saat Anda memulai sesi baru atau memilih riwayat.</p>
    </fieldset>
  );
}

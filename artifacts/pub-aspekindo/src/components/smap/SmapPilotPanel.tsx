import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useSmapPilot } from "@/hooks/useSmapPilot";

const names = {
  surat_pernyataan: "Surat pernyataan",
  sertifikat_iso: "Sertifikat ISO",
  pendidikan_antikorupsi: "Pendidikan antikorupsi",
};

export default function SmapPilotPanel() {
  const pilot = useSmapPilot();
  const [selected, setSelected] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  useEffect(() => { setSelected([]); setConsent(false); }, [pilot.documents]);
  const change = (id: string) => {
    pilot.cancel();
    setConsent(false);
    setSelected(previous => previous.includes(id) ? previous.filter(value => value !== id) :
      previous.length < 5 ? [...previous, id] : previous);
  };
  const analyze = () => {
    if (!consent || selected.length === 0 || pilot.busy) return;
    setConsent(false);
    void pilot.analyze(pilot.documents.filter(doc => selected.includes(doc.id)).map(doc => doc.id));
  };
  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-4 sm:p-6" aria-label="Pilot Hermes dan Claude">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-pub-amber">Preview · Baca-saja</p>
        <h2 className="mt-1 text-xl font-semibold text-foreground">Periksa indikator SMAP dengan Hermes + Claude</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Pilih 1–5 catatan milik Anda. Hermes membantu menelaah indikator keterisian, bukan isi atau keabsahan dokumen.
          Pemeriksaan ini tidak mengubah maupun menyimpan ulang catatan.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-background p-4 text-sm text-foreground">
        <h3 className="font-semibold">Data yang dikirim ke Claude melalui OpenRouter</h3>
        <p className="mt-2">Hanya jenis dokumen, urutan pilihan, serta indikator Ya/Tidak di bawah.
          Nama, nomor dokumen, nilai kolom, ID akun, tanggal, isi berkas, tautan unduhan,
          dan jawaban assessment tidak dikirim. Metadata dibaca ulang saat analisis.</p>
        <p className="mt-2 text-muted-foreground">Indikator “terisi” bukan bukti isi benar, berkas tersedia,
          sertifikat sah, atau masa berlaku belum berakhir. Maksimum 3 analisis per anggota dan 10 total per jam di proses preview ini.
          Penggunaan Claude mengikuti layanan/API yang terhubung; tidak dijanjikan gratis.</p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{selected.length}/5 dipilih · hingga 50 catatan terbaru</span>
        <Button variant="outline" size="sm" disabled={!!pilot.busy} onClick={() => void pilot.refresh()}>Muat ulang daftar</Button>
      </div>
      {pilot.busy === "list" && <p role="status">Memuat indikator catatan Anda…</p>}
      {!pilot.busy && !pilot.error && pilot.documents.length === 0 && <p>Belum ada catatan. Tambahkan catatan pada tab SMAP lainnya, lalu muat ulang daftar.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {pilot.documents.map(doc => (
          <div key={doc.id} className={`rounded-lg border p-4 ${selected.includes(doc.id) ? "border-pub-amber bg-pub-amber/5" : "border-border"}`}>
            <label className="flex cursor-pointer items-start gap-3 text-foreground">
              <input type="checkbox" className="mt-1" checked={selected.includes(doc.id)}
                disabled={!!pilot.busy || (!selected.includes(doc.id) && selected.length >= 5)}
                onChange={() => change(doc.id)} aria-label={`Pilih ${names[doc.type]} ${doc.id.slice(0, 8)}`} />
              <span><span className="font-semibold">{names[doc.type]}</span>
                {selected.includes(doc.id) && <span className="ml-2 text-xs text-pub-amber">
                  Dokumen {pilot.documents.filter(item => selected.includes(item.id)).findIndex(item => item.id === doc.id) + 1}
                </span>}
                <span className="block text-xs text-muted-foreground">
                  Catatan {doc.id.slice(0, 8)}{doc.createdAt ? ` · ${new Date(doc.createdAt).toLocaleDateString("id-ID")}` : ""}
                </span>
              </span>
            </label>
            <ul className="mt-3 space-y-1 text-sm">
              {doc.checks.map(check => <li key={check.name} className="flex justify-between gap-3">
                <span className="text-muted-foreground">{check.name}</span>
                <span className={check.complete ? "text-foreground" : "text-pub-amber"}>{check.complete ? "Ya" : "Tidak"}</span>
              </li>)}
            </ul>
          </div>
        ))}
      </div>
      <label className="flex items-start gap-3 text-sm text-foreground">
        <input type="checkbox" className="mt-1" checked={consent} disabled={!!pilot.busy || selected.length === 0}
          onChange={event => setConsent(event.target.checked)} />
        <span>Saya menyetujui pengiriman indikator catatan yang saya pilih ke Claude melalui OpenRouter untuk analisis ini.
          Hasil hanya draf saran, bukan verifikasi atau keputusan sertifikasi.</span>
      </label>
      <div className="flex flex-wrap gap-3">
        <Button disabled={!consent || selected.length === 0 || !!pilot.busy} onClick={analyze}>
          {pilot.busy === "analysis" ? "Hermes sedang menganalisis…" : "Analisis pilihan dengan Claude"}
        </Button>
        {pilot.busy === "analysis" && <Button variant="outline" onClick={() => {
          pilot.cancel(); setConsent(false);
        }}>Batalkan</Button>}
      </div>
      <p className="text-xs text-muted-foreground">Hasil tidak disimpan. Mengubah pilihan atau memuat ulang menghapus hasil.
        Tidak ada pengiriman ulang otomatis. Pembatalan tidak dapat menarik kembali permintaan yang sudah dikirim.</p>
      {pilot.error && <p role="alert" className="rounded-lg border border-destructive p-3 text-sm text-foreground">{pilot.error}</p>}
      {pilot.result && <div className="space-y-3 rounded-lg border border-border bg-background p-4" role="status">
        <h3 className="font-semibold">Draf saran · {pilot.result.documentCount} catatan</h3>
        <p className="text-xs text-muted-foreground">Runtime: Hermes · Model: {pilot.result.model} · Indikator keterisian saja</p>
        <p className="whitespace-pre-wrap text-sm text-foreground">{pilot.result.analysis}</p>
        <p className="text-xs text-muted-foreground">Nomor dokumen mengikuti urutan daftar pilihan. Tidak ada isi lampiran yang diperiksa.
          Verifikasi isi dan rujukan resmi tetap diperlukan.</p>
      </div>}
    </section>
  );
}

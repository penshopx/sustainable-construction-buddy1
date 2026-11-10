import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectFacts } from "@/lib/brainProject";

const SHORT: { key: keyof ProjectFacts; label: string; ph: string }[] = [
  { key: "name", label: "Nama atau jenis proyek", ph: "Gedung kantor 4 lantai, Kab. Sleman" },
  { key: "owner", label: "Pemberi kerja", ph: "Pemda / BUMN / swasta" },
  { key: "contractType", label: "Jenis kontrak", ph: "Harga satuan, lumsum, gabungan" },
  { key: "progress", label: "Progres fisik", ph: "Rencana 46%, realisasi 38%" },
  { key: "period", label: "Periode laporan", ph: "Minggu ke-22 dari 40" },
];

export default function ProjectFactsForm({ value, onChange }: { value: ProjectFacts; onChange: (v: ProjectFacts) => void }) {
  const set = (k: keyof ProjectFacts, v: string) => onChange({ ...value, [k]: v });
  return (
    <section aria-labelledby="facts-title" className="rounded-xl border-2 border-border bg-card p-4">
      <h3 id="facts-title" className="font-heading text-base font-bold">Fakta proyek</h3>
      <p className="mt-1 text-sm text-muted-foreground">Tulis apa yang Anda ketahui. Yang kosong akan diperlakukan sebagai celah data, bukan ditebak.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {SHORT.map(f => (
          <div key={f.key}>
            <Label htmlFor={`fact-${f.key}`}>{f.label}</Label>
            <Input id={`fact-${f.key}`} maxLength={140} value={value[f.key]} placeholder={f.ph} onChange={e => set(f.key, e.target.value)} className="mt-1" data-testid={`input-fact-${f.key}`} />
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-3">
        <div>
          <Label htmlFor="fact-issues">Masalah atau gejala yang terlihat</Label>
          <Textarea id="fact-issues" rows={4} maxLength={1200} value={value.issues} onChange={e => set("issues", e.target.value)} className="mt-1" data-testid="input-fact-issues"
            placeholder="Pengecoran tertunda 3 minggu karena pasokan beton; termin 4 belum cair; dua subkon minta eskalasi harga." />
        </div>
        <div>
          <Label htmlFor="fact-question">Keputusan yang perlu Anda ambil</Label>
          <Textarea id="fact-question" rows={2} maxLength={500} value={value.question} onChange={e => set("question", e.target.value)} className="mt-1" data-testid="input-fact-question"
            placeholder="Apakah perlu ajukan perpanjangan waktu atau tambah regu kerja?" />
        </div>
      </div>
    </section>
  );
}

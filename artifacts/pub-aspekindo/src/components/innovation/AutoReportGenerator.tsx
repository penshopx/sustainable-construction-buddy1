import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileOutput } from "lucide-react";

export default function AutoReportGenerator() {
  const [project, setProject] = useState("");
  const [period, setPeriod] = useState("");
  const [planned, setPlanned] = useState("");
  const [actual, setActual] = useState("");
  const [issues, setIssues] = useState("");
  const [budget, setBudget] = useState("");
  const [spent, setSpent] = useState("");
  const [report, setReport] = useState("");

  const fmt = (n: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);

  const generate = () => {
    const p = Number(planned), a = Number(actual), b = Number(budget), s = Number(spent);
    const deviation = p > 0 ? ((a - p) / p * 100).toFixed(1) : "0";
    const costDev = b > 0 ? ((s - b) / b * 100).toFixed(1) : "0";
    const statusProgress = a >= p ? "✅ On Track" : a >= p * 0.9 ? "⚠️ Sedikit Tertinggal" : "🔴 Terlambat Signifikan";
    const statusBudget = s <= b ? "✅ Dalam Anggaran" : s <= b * 1.05 ? "⚠️ Mendekati Batas" : "🔴 Over Budget";

    setReport(`
📋 LAPORAN PROGRES PROYEK
========================
Proyek: ${project}
Periode: ${period}
Tanggal Laporan: ${new Date().toLocaleDateString("id-ID")}

📊 PROGRES FISIK
- Rencana: ${p}%
- Aktual: ${a}%
- Deviasi: ${deviation}%
- Status: ${statusProgress}

💰 REALISASI ANGGARAN
- Budget: Rp ${fmt(b)}
- Terpakai: Rp ${fmt(s)}
- Deviasi: ${costDev}%
- Status: ${statusBudget}

⚠️ KENDALA & RISIKO
${issues || "Tidak ada kendala signifikan."}

📌 REKOMENDASI
${a < p ? "- Perlu percepatan untuk mencapai target progres\n- Evaluasi metode kerja dan produktivitas\n- Pertimbangkan penambahan shift atau resources" : "- Pertahankan kecepatan progres saat ini\n- Monitor quality control secara ketat"}
${s > b ? "\n- Lakukan cost review mendesak\n- Identifikasi sumber pembengkakan biaya" : ""}

---
Dokumen ini dibuat secara otomatis oleh Automated Reporting Generator - Inovasi PUB
    `.trim());
  };

  return (
    <div className="space-y-6">
      <Card className="border-pub-amber/30 bg-gradient-to-br from-amber-50/50 to-background dark:from-amber-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><FileOutput className="w-5 h-5 text-pub-amber" /> Automated Reporting Generator</CardTitle>
          <p className="text-sm text-muted-foreground">Buat laporan progres proyek otomatis dari data yang diinput.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Nama Proyek</Label><Input value={project} onChange={e => setProject(e.target.value)} placeholder="Gedung Kantor" /></div>
            <div><Label className="text-xs">Periode</Label><Input value={period} onChange={e => setPeriod(e.target.value)} placeholder="Minggu ke-12" /></div>
            <div><Label className="text-xs">Progres Rencana (%)</Label><Input type="number" value={planned} onChange={e => setPlanned(e.target.value)} /></div>
            <div><Label className="text-xs">Progres Aktual (%)</Label><Input type="number" value={actual} onChange={e => setActual(e.target.value)} /></div>
            <div><Label className="text-xs">Budget (Rp)</Label><Input type="number" value={budget} onChange={e => setBudget(e.target.value)} /></div>
            <div><Label className="text-xs">Terpakai (Rp)</Label><Input type="number" value={spent} onChange={e => setSpent(e.target.value)} /></div>
          </div>
          <div><Label className="text-xs">Kendala/Risiko</Label><Textarea value={issues} onChange={e => setIssues(e.target.value)} placeholder="Jelaskan kendala jika ada..." rows={2} /></div>
          <Button onClick={generate} className="w-full bg-pub-amber hover:bg-pub-amber/90 text-white">Generate Laporan</Button>
        </CardContent>
      </Card>
      {report && (
        <Card><CardContent className="pt-6">
          <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/50 p-4 rounded-lg">{report}</pre>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => navigator.clipboard.writeText(report)}>📋 Salin ke Clipboard</Button>
        </CardContent></Card>
      )}
    </div>
  );
}

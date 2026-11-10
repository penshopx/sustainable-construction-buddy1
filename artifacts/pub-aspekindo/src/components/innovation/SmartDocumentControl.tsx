import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText } from "lucide-react";

const docCategories = [
  { category: "Kontrak & Legal", docs: ["Surat Kontrak", "Addendum", "SPMK", "Jaminan Pelaksanaan", "Jaminan Uang Muka"] },
  { category: "Teknis", docs: ["Gambar Kerja", "Spesifikasi Teknis", "RKS", "Metode Pelaksanaan", "Schedule/Kurva S"] },
  { category: "Keuangan", docs: ["RAB", "Laporan Progress Keuangan", "Invoice/Termin", "BA Opname", "Bukti Pembayaran"] },
  { category: "K3L", docs: ["RK3L", "Safety Plan", "Laporan Kecelakaan", "Inspeksi K3", "AMDAL/UKL-UPL"] },
  { category: "Mutu", docs: ["RMP", "ITP", "Laporan Uji Material", "NCR", "Sertifikat Material"] },
];

export default function SmartDocumentControl() {
  const [checkedDocs, setCheckedDocs] = useState<Set<string>>(new Set());
  const [projectName, setProjectName] = useState("");
  const [analyzed, setAnalyzed] = useState(false);

  const toggleDoc = (doc: string) => {
    const next = new Set(checkedDocs);
    if (next.has(doc)) {
      next.delete(doc);
    } else {
      next.add(doc);
    }
    setCheckedDocs(next);
  };

  const totalDocs = docCategories.reduce((s, c) => s + c.docs.length, 0);
  const completeness = Math.round((checkedDocs.size / totalDocs) * 100);

  return (
    <div className="space-y-6">
      <Card className="border-pub-sky/30 bg-gradient-to-br from-sky-50/50 to-background dark:from-sky-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><FileText className="w-5 h-5 text-pub-sky" /> Smart Document Control</CardTitle>
          <p className="text-sm text-muted-foreground">Kelola kelengkapan dokumen proyek – checklist 25 dokumen kritis.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><Label className="text-xs">Nama Proyek</Label><Input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Gedung Kantor XYZ" /></div>
          {docCategories.map(cat => (
            <div key={cat.category}>
              <p className="text-xs font-bold text-muted-foreground mb-2">{cat.category}</p>
              {cat.docs.map(doc => (
                <label key={doc} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer">
                  <Checkbox checked={checkedDocs.has(doc)} onCheckedChange={() => toggleDoc(doc)} />
                  <span className="text-sm">{doc}</span>
                </label>
              ))}
            </div>
          ))}
          <Button onClick={() => setAnalyzed(true)} className="w-full bg-pub-sky hover:bg-pub-sky/90 text-white">
            Cek Kelengkapan ({checkedDocs.size}/{totalDocs})
          </Button>
        </CardContent>
      </Card>
      {analyzed && (
        <Card><CardContent className="pt-6 text-center space-y-3">
          <p className={`text-4xl font-bold ${completeness >= 80 ? "text-emerald-600" : completeness >= 50 ? "text-amber-600" : "text-destructive"}`}>{completeness}%</p>
          <Badge className={completeness >= 80 ? "bg-emerald-600 text-white" : completeness >= 50 ? "bg-amber-500 text-white" : "bg-destructive"}>
            {completeness >= 80 ? "Lengkap" : completeness >= 50 ? "Perlu Dilengkapi" : "Belum Lengkap"}
          </Badge>
          {completeness < 100 && (
            <div className="text-left mt-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Dokumen belum lengkap:</p>
              {docCategories.map(cat => {
                const missing = cat.docs.filter(d => !checkedDocs.has(d));
                if (missing.length === 0) return null;
                return <div key={cat.category} className="mb-2"><p className="text-xs font-bold">{cat.category}:</p>{missing.map(d => <p key={d} className="text-xs text-destructive ml-3">• {d}</p>)}</div>;
              })}
            </div>
          )}
        </CardContent></Card>
      )}
    </div>
  );
}

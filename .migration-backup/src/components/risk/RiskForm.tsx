import { useState, useMemo } from "react";
import { type RiskInsert, computeCompleteness } from "@/hooks/useRiskRegisters";
import type { Project } from "@/hooks/useProjects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { RiskMatrix, RiskMatrixGrid } from "@/components/risk/RiskMatrix";
import { Save, ShieldAlert } from "lucide-react";

interface RiskFormProps {
  projectId: string | null;
  projects?: Project[];
  onSubmit: (data: RiskInsert) => void;
  isSubmitting: boolean;
}

export function RiskForm({ projectId, projects = [], onSubmit, isSubmitting }: RiskFormProps) {
  const [form, setForm] = useState<RiskInsert>({
    project_id: projectId,
    risk_description: '',
    probability_score: 1,
    impact_score: 1,
    mitigation_action: '',
    owner: '',
    status: 'open',
    due_date: null,
  });

  const completeness = useMemo(() => computeCompleteness(form), [form]);
  const points = completeness >= 80 ? 5 : completeness >= 60 ? 3 : completeness >= 40 ? 2 : 1;

  const update = (key: keyof RiskInsert, val: unknown) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="font-heading text-lg flex items-center gap-2"><ShieldAlert className="w-5 h-5" /> Identifikasi Risiko</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {projects.length > 0 && (
                <div className="space-y-2">
                  <Label>Proyek</Label>
                  <Select value={form.project_id || 'none'} onValueChange={v => update('project_id', v === 'none' ? null : v)}>
                    <SelectTrigger><SelectValue placeholder="Pilih Proyek (opsional)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tanpa Proyek</SelectItem>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Deskripsi Risiko *</Label>
                <Textarea value={form.risk_description} onChange={e => update('risk_description', e.target.value)} placeholder="Contoh: Keterlambatan pengiriman material baja dari supplier utama akibat gangguan logistik, berpotensi memperlambat pekerjaan struktur lantai 3-5 selama 2 minggu." rows={3} required />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Probabilitas (1-5)</Label>
                  <Select value={String(form.probability_score)} onValueChange={v => update('probability_score', Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map(v => (
                        <SelectItem key={v} value={String(v)}>{v} — {['Sangat Rendah', 'Rendah', 'Sedang', 'Tinggi', 'Sangat Tinggi'][v - 1]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Dampak (1-5)</Label>
                  <Select value={String(form.impact_score)} onValueChange={v => update('impact_score', Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map(v => (
                        <SelectItem key={v} value={String(v)}>{v} — {['Tidak Signifikan', 'Minor', 'Moderat', 'Major', 'Katastropik'][v - 1]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Rencana Mitigasi</Label>
                <Textarea value={form.mitigation_action} onChange={e => update('mitigation_action', e.target.value)} placeholder="Contoh: 1) Identifikasi 2 supplier alternatif baja (PT Krakatau Steel & PT Gunung Raja Paksi). 2) Pesan stok buffer 20% lebih awal. 3) Siapkan jadwal kerja lembur untuk catch-up." rows={2} />
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Penanggung Jawab</Label>
                  <Input value={form.owner} onChange={e => update('owner', e.target.value)} placeholder="Contoh: Ir. Budi Santoso (Project Manager)" />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => update('status', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="mitigated">Mitigated</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target Selesai</Label>
                  <Input type="date" value={form.due_date || ''} onChange={e => update('due_date', e.target.value || null)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="sticky top-4 border-pub-amber/30">
            <CardHeader className="pb-3">
              <CardTitle className="font-heading text-lg">Risk Score</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RiskMatrix probability={form.probability_score} impact={form.impact_score} />
              <RiskMatrixGrid probability={form.probability_score} impact={form.impact_score} />
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Kelengkapan</span>
                  <span className="font-heading font-bold">{completeness}%</span>
                </div>
                <Progress value={completeness} className="h-2" />
              </div>
              <div className="text-center p-3 rounded-lg bg-pub-amber/10 border border-pub-amber/20">
                <p className="text-xs text-muted-foreground font-body">Poin Kompetensi</p>
                <p className="text-2xl font-bold font-heading text-pub-amber">+{points}</p>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full bg-gradient-amber text-accent-foreground font-heading shadow-amber hover:brightness-110" disabled={!form.risk_description || isSubmitting}>
            <Save className="w-4 h-4 mr-1" />
            {isSubmitting ? 'Menyimpan...' : 'Simpan Risiko'}
          </Button>
        </div>
      </div>
    </form>
  );
}

import { useState, useMemo } from "react";
import { type ProjectInsert } from "@/hooks/useProjects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { computeComplexityScore, getComplexityLabel, getComplexityPoints } from "@/lib/complexity";
import { Save, TrendingUp } from "lucide-react";

interface ProjectFormProps {
  onSubmit: (data: ProjectInsert) => void;
  isSubmitting: boolean;
  initialData?: Partial<ProjectInsert>;
}

export function ProjectForm({ onSubmit, isSubmitting, initialData }: ProjectFormProps) {
  const [form, setForm] = useState<ProjectInsert>({
    name: initialData?.name ?? '',
    bujk_name: initialData?.bujk_name ?? '',
    contract_type: initialData?.contract_type ?? 'lumpsum',
    value_amount: initialData?.value_amount ?? 0,
    duration_months: initialData?.duration_months ?? 0,
    multidiscipline: initialData?.multidiscipline ?? false,
    risk_class: initialData?.risk_class ?? 'low',
    location: initialData?.location ?? '',
    description: initialData?.description ?? '',
    status: initialData?.status ?? 'active',
    started_at: initialData?.started_at ?? null,
    ended_at: initialData?.ended_at ?? null,
  });

  const complexity = useMemo(() => {
    const score = computeComplexityScore(form);
    return { score, ...getComplexityLabel(score), points: getComplexityPoints(score) };
  }, [form]);

  const update = (key: keyof ProjectInsert, val: unknown) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid md:grid-cols-3 gap-6">
        {/* Main form */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="font-heading text-lg">Informasi Proyek</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nama Proyek *</Label>
                  <Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Pembangunan Gedung A" required />
                </div>
                <div className="space-y-2">
                  <Label>Nama BUJK</Label>
                  <Input value={form.bujk_name} onChange={e => update('bujk_name', e.target.value)} placeholder="PT Konstruksi Jaya" />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Lokasi</Label>
                  <Input value={form.location} onChange={e => update('location', e.target.value)} placeholder="Jakarta Selatan" />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => update('status', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Aktif</SelectItem>
                      <SelectItem value="completed">Selesai</SelectItem>
                      <SelectItem value="cancelled">Dibatalkan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Deskripsi</Label>
                <Textarea value={form.description} onChange={e => update('description', e.target.value)} placeholder="cth: Pembangunan gedung kantor 5 lantai dengan struktur beton bertulang, luas bangunan 3.200 m², meliputi pekerjaan struktur, arsitektur, MEP, dan lanskap." rows={3} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="font-heading text-lg">Parameter Kompleksitas</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nilai Proyek (Rp)</Label>
                  <Input type="number" value={form.value_amount || ''} onChange={e => update('value_amount', Number(e.target.value))} placeholder="cth: 25000000000 (Rp 25 Miliar)" />
                  <p className="text-xs text-muted-foreground">Rp {(form.value_amount / 1_000_000_000).toFixed(1)} Miliar</p>
                </div>
                <div className="space-y-2">
                  <Label>Durasi (bulan)</Label>
                  <Input type="number" value={form.duration_months || ''} onChange={e => update('duration_months', Number(e.target.value))} placeholder="12" />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Jenis Kontrak</Label>
                  <Select value={form.contract_type} onValueChange={v => update('contract_type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lumpsum">Lump Sum</SelectItem>
                      <SelectItem value="unit_price">Harga Satuan</SelectItem>
                      <SelectItem value="turnkey">Turnkey</SelectItem>
                      <SelectItem value="design_build">Design & Build</SelectItem>
                      <SelectItem value="epc">EPC</SelectItem>
                      <SelectItem value="cost_plus">Cost Plus</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Kelas Risiko</Label>
                  <Select value={form.risk_class} onValueChange={v => update('risk_class', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Rendah</SelectItem>
                      <SelectItem value="medium">Sedang</SelectItem>
                      <SelectItem value="high">Tinggi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.multidiscipline} onCheckedChange={v => update('multidiscipline', v)} />
                <Label>Proyek Multi-Disiplin</Label>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Complexity sidebar */}
        <div className="space-y-4">
          <Card className="sticky top-4 border-pub-amber/30">
            <CardHeader className="pb-3">
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-pub-amber" /> Skor Kompleksitas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-5xl font-extrabold font-heading text-primary">{complexity.score}</div>
                <Badge variant={complexity.color as 'default' | 'secondary' | 'destructive'} className="mt-2 text-sm px-3">
                  {complexity.label}
                </Badge>
              </div>
              <div className="text-center p-3 rounded-lg bg-pub-amber/10 border border-pub-amber/20">
                <p className="text-xs text-muted-foreground font-body">Poin Kompetensi</p>
                <p className="text-2xl font-bold font-heading text-pub-amber">+{complexity.points}</p>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Nilai proyek: pengaruh besar</p>
                <p>• Durasi &gt;12 bulan: +skor</p>
                <p>• Multi-disiplin: +3</p>
                <p>• Kontrak kompleks: +4</p>
                <p>• Risiko tinggi: +5</p>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full bg-gradient-amber text-accent-foreground font-heading shadow-amber hover:brightness-110" disabled={!form.name || isSubmitting}>
            <Save className="w-4 h-4 mr-1" />
            {isSubmitting ? 'Menyimpan...' : 'Simpan Proyek'}
          </Button>
        </div>
      </div>
    </form>
  );
}

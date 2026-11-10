import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BUDGET_CATEGORIES, computeBudgetCompleteness, getDeviationSeverity, type BudgetInsert } from "@/hooks/useBudgetEntries";
import { AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";

interface BudgetFormProps {
  projectId?: string;
  onSubmit: (data: BudgetInsert) => void;
  isSubmitting: boolean;
}

export function BudgetForm({ projectId, onSubmit, isSubmitting }: BudgetFormProps) {
  const [form, setForm] = useState<Partial<BudgetInsert>>({
    project_id: projectId || null,
    category: '',
    period_month: '',
    planned_amount: 0,
    actual_amount: 0,
    mitigation_plan: '',
    notes: '',
  });

  const completeness = computeBudgetCompleteness(form);
  const deviation = form.planned_amount && form.planned_amount > 0
    ? Math.round(((form.actual_amount || 0) - form.planned_amount) / form.planned_amount * 100 * 100) / 100
    : null;
  const severity = getDeviationSeverity(deviation);
  const points = completeness >= 80 ? 5 : completeness >= 60 ? 3 : completeness >= 40 ? 2 : 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form as BudgetInsert);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Tambah Entri Anggaran</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-heading">Kategori</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                <SelectContent>
                  {BUDGET_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-heading">Periode (YYYY-MM)</Label>
              <Input type="month" placeholder="2026-03" value={form.period_month} onChange={e => setForm(f => ({ ...f, period_month: e.target.value }))} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-heading">Anggaran Rencana (Rp)</Label>
              <Input type="number" min={0} value={form.planned_amount || ''} onChange={e => setForm(f => ({ ...f, planned_amount: Number(e.target.value) }))} placeholder="Contoh: 500000000" />
              <p className="text-xs text-muted-foreground mt-1">Contoh: Rp 500 juta untuk material beton bulan ini</p>
            </div>
            <div className="space-y-2">
              <Label className="font-heading">Realisasi Aktual (Rp)</Label>
              <Input type="number" min={0} value={form.actual_amount || ''} onChange={e => setForm(f => ({ ...f, actual_amount: Number(e.target.value) }))} placeholder="Contoh: 475000000" />
              <p className="text-xs text-muted-foreground mt-1">Jumlah realisasi aktual pada periode ini</p>
            </div>
          </div>

          {/* Live deviation indicator */}
          {deviation !== null && (
            <div className={`p-3 rounded-lg border flex items-center gap-3 ${severity === 'danger' ? 'border-destructive/50 bg-destructive/5' : severity === 'warning' ? 'border-pub-amber/50 bg-pub-amber/5' : 'border-pub-emerald/50 bg-pub-emerald/5'}`}>
              {severity === 'danger' ? <AlertTriangle className="w-5 h-5 text-destructive" /> : severity === 'warning' ? <AlertTriangle className="w-5 h-5 text-pub-amber" /> : <CheckCircle2 className="w-5 h-5 text-pub-emerald" />}
              <div>
                <p className="text-sm font-heading font-semibold">
                  Deviasi: {deviation > 0 ? '+' : ''}{deviation}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {severity === 'danger' ? 'Deviasi kritis — perlu tindakan segera' : severity === 'warning' ? 'Peringatan dini — monitor ketat' : 'Dalam batas normal'}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="font-heading">Rencana Mitigasi</Label>
            <Textarea value={form.mitigation_plan} onChange={e => setForm(f => ({ ...f, mitigation_plan: e.target.value }))} placeholder="Contoh: Negosiasi ulang harga dengan supplier, penggunaan material alternatif setara mutu, atau pengajuan addendum kontrak bila deviasi >10%." rows={2} />
          </div>

          <div className="space-y-2">
            <Label className="font-heading">Catatan</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Contoh: Kenaikan harga besi 8% dari bulan sebelumnya, sudah dikonfirmasi oleh bagian pengadaan." rows={2} />
          </div>

          {/* Completeness & Points */}
          <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
            <div className="flex-1 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-heading">Kelengkapan</span>
                <span className="font-bold">{completeness}%</span>
              </div>
              <Progress value={completeness} className="h-2" />
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-pub-amber" />
              <span className="text-sm font-bold font-heading text-pub-amber">+{points} poin</span>
            </div>
          </div>

          <Button type="submit" disabled={isSubmitting || !form.category || !form.period_month} className="w-full bg-gradient-amber text-accent-foreground font-heading shadow-amber hover:brightness-110">
            {isSubmitting ? 'Menyimpan...' : 'Simpan Entri'}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}

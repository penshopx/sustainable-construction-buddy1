import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, DollarSign, AlertCircle, CheckCircle2, Plus, Trash2 } from "lucide-react";

interface RetentionItem {
  projectName: string;
  retentionAmount: string;
  maintenanceEnd: string;
  docComplete: boolean;
}

interface Result {
  projectName: string;
  amount: number;
  daysLeft: number;
  status: "overdue" | "urgent" | "upcoming" | "safe";
  docComplete: boolean;
}

export default function RetentionPlanner() {
  const [items, setItems] = useState<RetentionItem[]>([
    { projectName: "", retentionAmount: "", maintenanceEnd: "", docComplete: false },
  ]);
  const [results, setResults] = useState<Result[]>([]);

  const addItem = () => setItems([...items, { projectName: "", retentionAmount: "", maintenanceEnd: "", docComplete: false }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  const updateItem = <K extends keyof RetentionItem>(i: number, field: K, value: RetentionItem[K]) => {
    const item = items[i];
    if (!item) return;
    const copy = [...items];
    copy[i] = { ...item, [field]: value };
    setItems(copy);
  };

  const analyze = () => {
    const today = new Date();
    const res: Result[] = items
      .filter((it) => it.projectName && it.retentionAmount && it.maintenanceEnd)
      .map((it) => {
        const endDate = new Date(it.maintenanceEnd);
        const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const status: Result["status"] = daysLeft < 0 ? "overdue" : daysLeft <= 14 ? "urgent" : daysLeft <= 30 ? "upcoming" : "safe";
        return {
          projectName: it.projectName,
          amount: Number(it.retentionAmount),
          daysLeft,
          status,
          docComplete: it.docComplete,
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
    setResults(res);
  };

  const totalRetention = results.reduce((s, r) => s + r.amount, 0);
  const overdueTotal = results.filter((r) => r.status === "overdue").reduce((s, r) => s + r.amount, 0);
  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);

  return (
    <div className="space-y-6">
      <Card className="border-violet-500/30 bg-gradient-to-br from-violet-50/50 to-background dark:from-violet-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="w-5 h-5 text-violet-600" />
            Retention Recovery Planner
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Tracking retensi proyek, jatuh tempo, dan kelengkapan dokumen pencairan.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, i) => (
            <div key={i} className="p-3 border rounded-lg space-y-3 relative">
              {items.length > 1 && (
                <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => removeItem(i)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nama Proyek</Label>
                  <Input placeholder="Gedung A" value={item.projectName} onChange={(e) => updateItem(i, "projectName", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Nilai Retensi (Rp)</Label>
                  <Input type="number" placeholder="500000000" value={item.retentionAmount} onChange={(e) => updateItem(i, "retentionAmount", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Akhir Masa Pemeliharaan</Label>
                  <Input type="date" value={item.maintenanceEnd} onChange={(e) => updateItem(i, "maintenanceEnd", e.target.value)} />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={item.docComplete} onChange={(e) => updateItem(i, "docComplete", e.target.checked)} className="rounded" />
                    Dokumen lengkap
                  </label>
                </div>
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addItem}><Plus className="w-3 h-3 mr-1" /> Tambah Proyek</Button>
            <Button onClick={analyze} className="bg-violet-600 hover:bg-violet-700 text-white">Analisis Retensi</Button>
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dashboard Retensi</CardTitle>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <DollarSign className="w-4 h-4 mx-auto text-violet-600" />
                <p className="text-lg font-bold">Rp {fmt(totalRetention)}</p>
                <p className="text-xs text-muted-foreground">Total Retensi</p>
              </div>
              <div className={`p-3 rounded-lg text-center ${overdueTotal > 0 ? "bg-destructive/10" : "bg-emerald-50 dark:bg-emerald-950/20"}`}>
                <AlertCircle className={`w-4 h-4 mx-auto ${overdueTotal > 0 ? "text-destructive" : "text-emerald-600"}`} />
                <p className="text-lg font-bold">Rp {fmt(overdueTotal)}</p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {results.map((r, i) => (
              <div key={i} className={`p-3 rounded-lg border flex items-center gap-3 ${
                r.status === "overdue" ? "border-destructive/40 bg-destructive/5" :
                r.status === "urgent" ? "border-amber-500/40 bg-amber-50 dark:bg-amber-950/20" :
                r.status === "upcoming" ? "border-blue-500/40 bg-blue-50 dark:bg-blue-950/20" :
                "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/20"
              }`}>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{r.projectName}</p>
                  <p className="text-xs text-muted-foreground">Rp {fmt(r.amount)}</p>
                </div>
                <div className="text-right">
                  <Badge variant={r.status === "overdue" ? "destructive" : r.status === "urgent" ? "default" : "secondary"}
                    className={r.status === "urgent" ? "bg-amber-500 text-white" : ""}>
                    {r.status === "overdue" ? `Overdue ${Math.abs(r.daysLeft)} hari` :
                     `H-${r.daysLeft} hari`}
                  </Badge>
                  <div className="mt-1">
                    {r.docComplete ?
                      <span className="text-xs text-emerald-600 flex items-center gap-1 justify-end"><CheckCircle2 className="w-3 h-3" /> Dokumen OK</span> :
                      <span className="text-xs text-destructive flex items-center gap-1 justify-end"><AlertCircle className="w-3 h-3" /> Dokumen belum</span>
                    }
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, FileText } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface VO { description: string; costImpact: string; timeImpact: string; status: string; hasDoc: boolean }

export default function VODefenseTracker() {
  const [items, setItems] = useState<VO[]>([{ description: "", costImpact: "", timeImpact: "", status: "pending", hasDoc: false }]);
  const add = () => setItems([...items, { description: "", costImpact: "", timeImpact: "", status: "pending", hasDoc: false }]);
  const remove = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const update = <K extends keyof VO>(i: number, f: K, v: VO[K]) => {
    const item = items[i];
    if (!item) return;
    const c = [...items];
    c[i] = { ...item, [f]: v };
    setItems(c);
  };

  const totalCost = items.reduce((s, v) => s + (Number(v.costImpact) || 0), 0);
  const totalDays = items.reduce((s, v) => s + (Number(v.timeImpact) || 0), 0);
  const pendingCount = items.filter(v => v.status === "pending" && v.description).length;
  const noDocCount = items.filter(v => !v.hasDoc && v.description).length;
  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);

  return (
    <div className="space-y-6">
      <Card className="border-pub-emerald/30 bg-gradient-to-br from-emerald-50/50 to-background dark:from-emerald-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><FileText className="w-5 h-5 text-pub-emerald" /> Variation Order Defense Tracker</CardTitle>
          <p className="text-sm text-muted-foreground">Catat & lacak semua VO untuk memperkuat posisi klaim.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((v, i) => (
            <div key={i} className="p-3 border rounded-lg space-y-2 relative">
              {items.length > 1 && <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => remove(i)}><Trash2 className="w-3 h-3" /></Button>}
              <div><Label className="text-xs">Deskripsi Perubahan</Label><Input placeholder="Perubahan desain pondasi" value={v.description} onChange={e => update(i, "description", e.target.value)} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-xs">Dampak Biaya (Rp)</Label><Input type="number" value={v.costImpact} onChange={e => update(i, "costImpact", e.target.value)} /></div>
                <div><Label className="text-xs">Dampak Waktu (hari)</Label><Input type="number" value={v.timeImpact} onChange={e => update(i, "timeImpact", e.target.value)} /></div>
                <div><Label className="text-xs">Status</Label>
                  <Select value={v.status} onValueChange={val => update(i, "status", val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="submitted">Diajukan</SelectItem>
                      <SelectItem value="approved">Disetujui</SelectItem>
                      <SelectItem value="rejected">Ditolak</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={v.hasDoc} onChange={e => update(i, "hasDoc", e.target.checked)} className="rounded" />
                Dokumentasi lengkap (foto, surat instruksi, kronologi)
              </label>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={add}><Plus className="w-3 h-3 mr-1" />Tambah VO</Button>
        </CardContent>
      </Card>
      {items.some(v => v.description) && (
        <Card><CardContent className="pt-6 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-3 rounded-lg bg-muted/50"><p className="text-xl font-bold">Rp {fmt(totalCost)}</p><p className="text-xs text-muted-foreground">Total Klaim VO</p></div>
            <div className="p-3 rounded-lg bg-muted/50"><p className="text-xl font-bold">+{totalDays} hari</p><p className="text-xs text-muted-foreground">Perpanjangan Waktu</p></div>
          </div>
          <div className="flex gap-2">
            {pendingCount > 0 && <Badge className="bg-amber-500">{pendingCount} Pending</Badge>}
            {noDocCount > 0 && <Badge variant="destructive">{noDocCount} Tanpa Dokumen</Badge>}
            {noDocCount > 0 && <p className="text-xs text-destructive">⚠️ VO tanpa dokumentasi lengkap sangat lemah saat klaim!</p>}
          </div>
        </CardContent></Card>
      )}
    </div>
  );
}

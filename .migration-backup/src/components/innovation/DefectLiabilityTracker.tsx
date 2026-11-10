import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Bug } from "lucide-react";

interface DefectItem { area: string; description: string; dueDate: string; fixed: boolean }

export default function DefectLiabilityTracker() {
  const [items, setItems] = useState<DefectItem[]>([{ area: "", description: "", dueDate: "", fixed: false }]);
  const add = () => setItems([...items, { area: "", description: "", dueDate: "", fixed: false }]);
  const remove = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const update = <K extends keyof DefectItem>(i: number, f: K, v: DefectItem[K]) => {
    const item = items[i];
    if (!item) return;
    const c = [...items];
    c[i] = { ...item, [f]: v };
    setItems(c);
  };

  const today = new Date();
  const stats = items.filter(it => it.description).map(it => {
    const due = new Date(it.dueDate);
    const daysLeft = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return { ...it, daysLeft, overdue: !it.fixed && daysLeft < 0 };
  });
  const openCount = stats.filter(s => !s.fixed).length;
  const overdueCount = stats.filter(s => s.overdue).length;

  return (
    <div className="space-y-6">
      <Card className="border-violet-500/30 bg-gradient-to-br from-violet-50/50 to-background dark:from-violet-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Bug className="w-5 h-5 text-violet-600" /> Defect Liability Tracker</CardTitle>
          <p className="text-sm text-muted-foreground">Tracking defect/snag list selama masa pemeliharaan.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-5 gap-2 items-end">
              <div><Label className="text-xs">Area</Label><Input placeholder="Lt. 3" value={it.area} onChange={e => update(i, "area", e.target.value)} /></div>
              <div className="col-span-2"><Label className="text-xs">Deskripsi Defect</Label><Input placeholder="Cat mengelupas" value={it.description} onChange={e => update(i, "description", e.target.value)} /></div>
              <div><Label className="text-xs">Deadline</Label><Input type="date" value={it.dueDate} onChange={e => update(i, "dueDate", e.target.value)} /></div>
              <div className="flex gap-1 items-center">
                <label className="text-xs flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={it.fixed} onChange={e => update(i, "fixed", e.target.checked)} className="rounded" /> Fixed
                </label>
                {items.length > 1 && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(i)}><Trash2 className="w-3 h-3" /></Button>}
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={add}><Plus className="w-3 h-3 mr-1" />Tambah Defect</Button>
        </CardContent>
      </Card>
      {stats.length > 0 && (
        <Card><CardContent className="pt-6 flex gap-3 justify-center">
          <Badge variant="secondary">{stats.length} Total</Badge>
          <Badge className="bg-emerald-600">{stats.filter(s => s.fixed).length} Fixed</Badge>
          {openCount > 0 && <Badge className="bg-amber-500">{openCount} Open</Badge>}
          {overdueCount > 0 && <Badge variant="destructive">{overdueCount} Overdue</Badge>}
        </CardContent></Card>
      )}
    </div>
  );
}

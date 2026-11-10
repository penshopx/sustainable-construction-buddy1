import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Fuel, AlertTriangle, CheckCircle2, Plus, Trash2 } from "lucide-react";

interface Equipment {
  id: string;
  name: string;
  type: string;
  standardRate: number; // L/jam standar
  actualFuel: number; // L hari ini
  hoursWorked: number; // jam kerja hari ini
}

const equipmentTypes: Record<string, { label: string; stdRate: number }> = {
  excavator_20t: { label: "Excavator 20 Ton", stdRate: 18 },
  excavator_30t: { label: "Excavator 30 Ton", stdRate: 25 },
  bulldozer: { label: "Bulldozer D6", stdRate: 22 },
  wheel_loader: { label: "Wheel Loader", stdRate: 15 },
  dump_truck: { label: "Dump Truck 20T", stdRate: 12 },
  crane_25t: { label: "Crane 25 Ton", stdRate: 20 },
  genset: { label: "Generator Set", stdRate: 10 },
  concrete_pump: { label: "Concrete Pump", stdRate: 16 },
};

const defaultEquipment: Equipment[] = [
  { id: "1", name: "EX-01", type: "excavator_20t", standardRate: 18, actualFuel: 200, hoursWorked: 8 },
  { id: "2", name: "DT-01", type: "dump_truck", standardRate: 12, actualFuel: 150, hoursWorked: 10 },
  { id: "3", name: "BZ-01", type: "bulldozer", standardRate: 22, actualFuel: 250, hoursWorked: 7 },
];

export default function FuelLossTracker() {
  const [items, setItems] = useState<Equipment[]>(defaultEquipment);
  const [fuelPrice, setFuelPrice] = useState(13500);

  const addItem = () => {
    setItems(prev => [...prev, {
      id: Date.now().toString(),
      name: `ALT-${prev.length + 1}`,
      type: "excavator_20t",
      standardRate: 18,
      actualFuel: 0,
      hoursWorked: 8,
    }]);
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  const updateItem = (id: string, field: keyof Equipment, val: Equipment[keyof Equipment]) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      if (field === 'type') {
        const t = equipmentTypes[val as string];
        return { ...item, type: val as string, standardRate: t?.stdRate || item.standardRate };
      }
      return { ...item, [field]: val };
    }));
  };

  const analysis = items.map(item => {
    const expectedFuel = item.standardRate * item.hoursWorked;
    const diff = item.actualFuel - expectedFuel;
    const diffPct = expectedFuel > 0 ? (diff / expectedFuel) * 100 : 0;
    const isAnomaly = diffPct > 15;
    const lossLiters = Math.max(0, diff);
    const lossCost = lossLiters * fuelPrice;
    return { ...item, expectedFuel, diff, diffPct, isAnomaly, lossLiters, lossCost };
  });

  const totalExpected = analysis.reduce((s, a) => s + a.expectedFuel, 0);
  const totalActual = analysis.reduce((s, a) => s + a.actualFuel, 0);
  const totalLoss = analysis.reduce((s, a) => s + a.lossLiters, 0);
  const totalLossCost = totalLoss * fuelPrice;
  const anomalyCount = analysis.filter(a => a.isAnomaly).length;
  const monthlyLoss = totalLossCost * 26; // 26 hari kerja

  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));

  return (
    <div className="space-y-6">
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold font-heading flex items-center justify-center gap-2">
          <Fuel className="w-5 h-5 text-pub-amber" /> Equipment & Fuel Loss Tracker
        </h2>
        <p className="text-sm text-muted-foreground">Deteksi anomali konsumsi BBM vs standar alat berat</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-xs text-muted-foreground">Standar (L)</p>
            <p className="text-lg font-bold">{fmt(totalExpected)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-xs text-muted-foreground">Aktual (L)</p>
            <p className="text-lg font-bold">{fmt(totalActual)}</p>
          </CardContent>
        </Card>
        <Card className={totalLoss > 0 ? "border-destructive/30" : "border-pub-emerald/30"}>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-xs text-muted-foreground">Selisih/Hari</p>
            <p className={`text-lg font-bold ${totalLoss > 0 ? 'text-destructive' : 'text-pub-emerald'}`}>{fmt(totalLoss)} L</p>
          </CardContent>
        </Card>
        <Card className={anomalyCount > 0 ? "border-destructive/30" : "border-pub-emerald/30"}>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-xs text-muted-foreground">Anomali</p>
            <p className={`text-lg font-bold ${anomalyCount > 0 ? 'text-destructive' : 'text-pub-emerald'}`}>{anomalyCount} alat</p>
          </CardContent>
        </Card>
      </div>

      {totalLoss > 0 && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-destructive">Potensi Kerugian BBM</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Harian: <span className="font-semibold text-foreground">Rp {fmt(totalLossCost)}</span> · 
                  Bulanan: <span className="font-semibold text-foreground">Rp {fmt(monthlyLoss)}</span> · 
                  Tahunan: <span className="font-semibold text-destructive">Rp {fmt(monthlyLoss * 12)}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fuel price */}
      <div className="flex items-center gap-3">
        <Label className="text-xs shrink-0">Harga Solar (Rp/L):</Label>
        <Input type="number" value={fuelPrice} onChange={(e) => setFuelPrice(Number(e.target.value) || 0)} className="w-32 h-8 text-xs" />
        <Button variant="outline" size="sm" onClick={addItem} className="gap-1 ml-auto">
          <Plus className="w-3.5 h-3.5" /> Tambah Alat
        </Button>
      </div>

      {/* Equipment items */}
      <div className="space-y-3">
        {analysis.map((item) => (
          <Card key={item.id} className={`${item.isAnomaly ? 'border-destructive/30 bg-destructive/5' : ''}`}>
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-center gap-2 sm:w-48">
                  <Input
                    value={item.name}
                    onChange={(e) => updateItem(item.id, "name", e.target.value)}
                    className="h-8 text-xs font-semibold w-20"
                  />
                  <Select value={item.type} onValueChange={(v) => updateItem(item.id, "type", v)}>
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(equipmentTypes).map(([k, v]) => (
                        <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <div className="flex items-center gap-1">
                    <Label className="text-[10px] w-10">Solar (L)</Label>
                    <Input type="number" value={item.actualFuel} onChange={(e) => updateItem(item.id, "actualFuel", Number(e.target.value) || 0)} className="h-8 w-20 text-xs" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Label className="text-[10px] w-10">Jam</Label>
                    <Input type="number" value={item.hoursWorked} onChange={(e) => updateItem(item.id, "hoursWorked", Number(e.target.value) || 0)} className="h-8 w-16 text-xs" />
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Standar: {fmt(item.expectedFuel)}L</p>
                    <p className={`text-sm font-bold ${item.isAnomaly ? 'text-destructive' : 'text-pub-emerald'}`}>
                      {item.diff > 0 ? '+' : ''}{fmt(item.diff)}L ({item.diffPct > 0 ? '+' : ''}{item.diffPct.toFixed(0)}%)
                    </p>
                    {item.isAnomaly && (
                      <Badge className="bg-destructive/15 text-destructive text-[10px] mt-0.5">
                        <AlertTriangle className="w-2.5 h-2.5 mr-1" />ANOMALI
                      </Badge>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(item.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

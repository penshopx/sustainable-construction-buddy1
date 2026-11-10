import { calculateProjectEvm } from "@/lib/projectEvm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type EvmFields = { bac: string; pv: string; ev: string; ac: string };
export const EMPTY_EVM: EvmFields = { bac: "", pv: "", ev: "", ac: "" };
type Out = ReturnType<typeof calculateProjectEvm>;
export type EvmResult =
  | { status: "empty" } | { status: "partial" } | { status: "invalid"; message: string }
  | { status: "ok"; input: { bac: number; pv: number; ev: number; ac: number }; out: Out };

const FIELDS: { key: keyof EvmFields; label: string; help: string }[] = [
  { key: "bac", label: "BAC", help: "Anggaran total saat selesai" },
  { key: "pv", label: "PV", help: "Nilai rencana s.d. tanggal laporan" },
  { key: "ev", label: "EV", help: "Nilai pekerjaan yang benar-benar selesai" },
  { key: "ac", label: "AC", help: "Biaya aktual yang sudah keluar" },
];

export function evaluateEvm(f: EvmFields): EvmResult {
  const raw = [f.bac, f.pv, f.ev, f.ac].map(v => v.trim());
  if (raw.every(v => v === "")) return { status: "empty" };
  if (raw.some(v => v === "")) return { status: "partial" };
  const [bac, pv, ev, ac] = raw.map(v => Number(v.replace(/\./g, "").replace(",", ".")));
  try {
    const input = { bac, pv, ev, ac };
    return { status: "ok", input, out: calculateProjectEvm(input) };
  } catch (e) {
    return { status: "invalid", message: e instanceof Error ? e.message : "Nilai EVM tidak valid." };
  }
}

const show = (v: number | null, d = 2) => (v === null ? "Tidak tersedia" : v.toLocaleString("id-ID", { maximumFractionDigits: d }));
const tone = (v: number | null) => (v === null ? "" : v >= 1 ? "text-pub-emerald" : "text-destructive");

export default function EvmPanel({ value, onChange, result }: { value: EvmFields; onChange: (v: EvmFields) => void; result: EvmResult }) {
  return (
    <section aria-labelledby="evm-title" className="rounded-xl border-2 border-border bg-card p-4">
      <h3 id="evm-title" className="font-heading text-base font-bold">Earned Value (opsional)</h3>
      <p className="mt-1 text-sm text-muted-foreground">Isi keempat nilai dalam satuan yang sama (mis. juta rupiah). Kolom kosong tidak dianggap nol. Gunakan koma untuk desimal; titik dibaca sebagai pemisah ribuan. Dihitung di perangkat Anda, tanpa AI.</p>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        {FIELDS.map(fl => (
          <div key={fl.key}>
            <Label htmlFor={`evm-${fl.key}`} className="font-mono font-bold">{fl.label}</Label>
            <Input id={`evm-${fl.key}`} inputMode="decimal" value={value[fl.key]} placeholder="kosong" data-testid={`input-evm-${fl.key}`}
              aria-describedby={`evm-${fl.key}-help`} onChange={e => onChange({ ...value, [fl.key]: e.target.value })} className="mt-1 font-mono" />
            <p id={`evm-${fl.key}-help`} className="mt-1 text-xs text-muted-foreground">{fl.help}</p>
          </div>
        ))}
      </div>
      <div className="mt-4" aria-live="polite">
        {result.status === "partial" && <p className="text-sm font-medium text-pub-amber">Lengkapi keempat nilai untuk menghitung. Analisis AI tetap bisa berjalan tanpa EVM.</p>}
        {result.status === "invalid" && <p role="alert" className="text-sm font-semibold text-destructive">{result.message} Syarat: angka tidak negatif, BAC lebih dari 0, PV dan EV tidak melebihi BAC.</p>}
        {result.status === "ok" && (
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border font-mono md:grid-cols-6">
            {([["CPI", result.out.cpi, 3, true], ["SPI", result.out.spi, 3, true], ["EAC", result.out.eac, 2, false], ["ETC", result.out.etc, 2, false], ["VAC", result.out.vac, 2, false], ["TCPI", result.out.tcpi, 3, false]] as const).map(([k, v, d, t]) => (
              <div key={k} className="bg-background p-3">
                <dt className="text-xs font-bold text-muted-foreground">{k}</dt>
                <dd className={`text-lg font-bold ${t ? tone(v) : ""}`} data-testid={`text-evm-${k.toLowerCase()}`}>{show(v, d)}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="mt-3 text-xs text-muted-foreground">Rumus: CPI = EV/AC, SPI = EV/PV, EAC = BAC/CPI (asumsi kinerja biaya saat ini berlanjut), ETC = EAC - AC, VAC = BAC - EAC, TCPI = (BAC - EV)/(BAC - AC). Bila penyebut nol, nilai ditampilkan "Tidak tersedia", bukan nol.</p>
      </div>
    </section>
  );
}

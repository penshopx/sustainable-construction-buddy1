import { Check } from "lucide-react";
import { STAGES, type StageId } from "@/lib/consultationFlow";

export default function StageRail({ current, completed }: { current: StageId; completed: StageId[] }) {
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Tahap konsultasi">
      {STAGES.map((s, i) => {
        const done = completed.includes(s.id);
        const active = !done && s.id === current;
        return (
          <li key={s.id} aria-current={active ? "step" : undefined}
            className={`rounded-lg border-2 p-3 ${done ? "border-pub-emerald bg-pub-emerald/10" : active ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
            <span className="flex items-center gap-2 font-mono text-xs font-bold">
              {done ? <Check className="h-4 w-4 text-pub-emerald" aria-hidden /> : <span>{i + 1}</span>}
              {done ? "Selesai" : active ? "Sekarang" : "Berikutnya"}
            </span>
            <span className="mt-1 block font-heading font-bold">{s.label}</span>
            <span className="hidden text-xs text-muted-foreground md:block">{s.hint}</span>
          </li>
        );
      })}
    </ol>
  );
}

import { PROFESSIONS } from "@/lib/consultationFlow";

export default function ProfessionPicker({ value, onChange, disabled }: { value: string | null; onChange: (id: string) => void; disabled: boolean }) {
  return (
    <fieldset disabled={disabled}>
      <legend className="font-heading text-lg font-bold">1. Pilih peran Anda</legend>
      <div role="radiogroup" className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {PROFESSIONS.map((p, i) => {
          const on = value === p.id;
          return (
            <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(p.id)} data-testid={`button-profession-${p.id}`}
              className={`rounded-xl border-2 p-4 text-left transition-colors disabled:opacity-60 ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary"}`}>
              <span className={`font-mono text-xs font-bold ${on ? "" : "text-pub-amber"}`}>{String(i + 1).padStart(2, "0")}</span>
              <span className="mt-1 block font-heading font-bold">{p.name}</span>
              <span className={`mt-1 block text-sm ${on ? "opacity-90" : "text-muted-foreground"}`}>{p.focus}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

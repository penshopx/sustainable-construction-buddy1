import { SCHEME_CATALOG, SCHEME_AUDIENCES, SCHEME_DEPTHS, SCHEME_ACTIONS, type SchemeProfile } from "@/lib/schemeChat";

export default function SchemeChatControls({ value, disabled, onChange, onAsk }: {
  value?: SchemeProfile; disabled: boolean; onChange: (value?: SchemeProfile) => void; onAsk: (text: string) => void;
}) {
  const selected = SCHEME_CATALOG.find(row => row.code === value?.scheme_code);
  const field = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50";
  return <section aria-label="Profil chat skema" className="mb-3 rounded-xl border border-border bg-card p-3 space-y-3">
    <div><h2 className="font-semibold text-sm">Pendamping skema konstruksi</h2>
      <p className="text-xs text-muted-foreground">77 subklasifikasi · referensi unggahan · draf pemetaan, bukan keputusan sertifikasi.</p></div>
    <div className="grid gap-3 md:grid-cols-3">
      <label className="text-sm space-y-1"><span>Skema / subklasifikasi</span>
        <select aria-label="Skema / subklasifikasi" className={field} disabled={disabled} value={value?.scheme_code ?? ""}
          onChange={e => onChange(e.target.value ? { scheme_code: e.target.value, audience: value?.audience ?? "bujk",
            explanation_depth: value?.explanation_depth ?? "praktis" } : undefined)}>
          <option value="">Chat umum — tanpa profil skema</option>
          {[...new Set(SCHEME_CATALOG.map(row => row.classification))].map(group => <optgroup key={group} label={group}>
            {SCHEME_CATALOG.filter(row => row.classification === group).map(row =>
              <option key={row.code} value={row.code}>{row.code} — {row.title}</option>)}
          </optgroup>)}
        </select>
      </label>
      <label className="text-sm space-y-1"><span>Peran percakapan</span>
        <select aria-label="Peran percakapan" className={field} disabled={disabled || !value} value={value?.audience ?? "bujk"}
          onChange={e => { if (value) onChange({ ...value, audience: e.target.value as SchemeProfile["audience"] }); }}>
          {SCHEME_AUDIENCES.map(row => <option key={row.value} value={row.value}>{row.label}</option>)}
        </select>
      </label>
      <label className="text-sm space-y-1"><span>Gaya penjelasan</span>
        <select aria-label="Gaya penjelasan" className={field} disabled={disabled || !value} value={value?.explanation_depth ?? "praktis"}
          onChange={e => { if (value) onChange({ ...value, explanation_depth: e.target.value as SchemeProfile["explanation_depth"] }); }}>
          {SCHEME_DEPTHS.map(row => <option key={row.value} value={row.value}>{row.label}</option>)}
        </select>
      </label>
    </div>
    <p className="text-xs text-muted-foreground">Mengganti profil memulai percakapan baru. Peran hanya mengubah fokus bantuan, bukan hak akses atau persyaratan.</p>
    {selected && <>
      <p className="text-sm"><strong>{selected.code}</strong> · KBLI {selected.kbliCode}</p>
      <details className="text-xs"><summary className="cursor-pointer">Rujukan dan catatan pemetaan</summary>
        <p className="mt-2">{selected.references.map(ref => `[${ref.id}, halaman PDF ${ref.page}]`).join(" · ")}</p>
        {selected.reviewNotes.map(note => <p key={note} className="mt-1">{note}</p>)}
        <p className="mt-1">Uraian KBLI bukan otomatis seluruh kewenangan subklasifikasi. Jawaban hanya berdasarkan bukti yang tersedia.</p>
      </details>
      <div className="flex flex-wrap gap-2">{SCHEME_ACTIONS.map(text => <button key={text} type="button" disabled={disabled}
        className="rounded-md border border-border px-3 py-2 text-xs hover:bg-muted disabled:opacity-50"
        onClick={() => onAsk(text)}>{text}</button>)}</div>
    </>}
  </section>;
}

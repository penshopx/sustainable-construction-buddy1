/**
 * Lightweight inline SVG-based illustrations for each onboarding step.
 * Each returns a small visual that sits inside the gradient header.
 */

export function WelcomeIllustration() {
  return (
    <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-3">
      <div className="flex -space-x-2">
        {["🏗️", "📊", "🎓", "🏆"].map((e, i) => (
          <span key={i} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg border-2 border-white/30">
            {e}
          </span>
        ))}
      </div>
      <span className="text-white/90 text-xs font-medium">11 modul siap digunakan</span>
    </div>
  );
}

export function DashboardIllustration() {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 flex gap-2">
      {[
        { label: "Learning", val: "85", color: "bg-blue-400" },
        { label: "Project", val: "72", color: "bg-emerald-400" },
        { label: "Toolkit", val: "68", color: "bg-amber-400" },
        { label: "Contrib", val: "45", color: "bg-purple-400" },
      ].map((e) => (
        <div key={e.label} className="flex-1 text-center">
          <div className="h-12 rounded bg-white/10 relative overflow-hidden mb-1">
            <div className={`absolute bottom-0 left-0 right-0 ${e.color}/60 rounded-b`} style={{ height: `${e.val}%` }} />
          </div>
          <span className="text-[10px] text-white/70 block">{e.label}</span>
          <span className="text-xs text-white font-bold">{e.val}</span>
        </div>
      ))}
    </div>
  );
}

export function ProjectsIllustration() {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 space-y-1.5">
      {[
        { name: "Gedung Kantor", status: "Aktif", pct: 75 },
        { name: "Jalan Tol Semarang", status: "Aktif", pct: 40 },
        { name: "Drainase Kota", status: "Selesai", pct: 100 },
      ].map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="flex-1">
            <span className="text-xs text-white font-medium block truncate">{p.name}</span>
            <div className="h-1.5 bg-white/10 rounded-full mt-0.5">
              <div className="h-full bg-white/60 rounded-full" style={{ width: `${p.pct}%` }} />
            </div>
          </div>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${p.pct === 100 ? "bg-white/30 text-white" : "bg-white/15 text-white/80"}`}>
            {p.pct}%
          </span>
        </div>
      ))}
    </div>
  );
}

export function RiskIllustration() {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
      <div className="grid grid-cols-5 gap-0.5">
        {Array.from({ length: 25 }).map((_, i) => {
          const row = Math.floor(i / 5);
          const col = i % 5;
          const level = row + col;
          const bg = level >= 6 ? "bg-red-400/60" : level >= 4 ? "bg-amber-400/60" : level >= 2 ? "bg-yellow-300/40" : "bg-green-400/40";
          const dot = (row === 3 && col === 4) || (row === 2 && col === 2) || (row === 1 && col === 3);
          return (
            <div key={i} className={`h-5 rounded-sm ${bg} flex items-center justify-center`}>
              {dot && <span className="w-2 h-2 rounded-full bg-white shadow-sm" />}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-white/60 mt-1.5 text-center">Risk Matrix 5×5</p>
    </div>
  );
}

export function BudgetIllustration() {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 flex items-end gap-1.5 h-20">
      {[
        { plan: 80, act: 75 },
        { plan: 60, act: 65 },
        { plan: 90, act: 85 },
        { plan: 70, act: 72 },
        { plan: 50, act: 55 },
      ].map((b, i) => (
        <div key={i} className="flex-1 flex gap-0.5 items-end h-full">
          <div className="flex-1 bg-white/20 rounded-t" style={{ height: `${b.plan}%` }} />
          <div className="flex-1 bg-white/50 rounded-t" style={{ height: `${b.act}%` }} />
        </div>
      ))}
    </div>
  );
}

export function K3Illustration() {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
      <div className="flex items-center gap-3">
        <div className="relative w-14 h-14">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
            <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="3" strokeDasharray="84.82" strokeDashoffset="8.48" strokeLinecap="round" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs text-white font-bold">90%</span>
        </div>
        <div className="space-y-1 flex-1">
          {["APD ✓", "Lingkungan ✓", "Peralatan ✓", "Prosedur ⚠"].map((c) => (
            <div key={c} className="text-[10px] text-white/80 bg-white/10 rounded px-2 py-0.5">{c}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LkutIllustration() {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">📄</span>
        <div>
          <span className="text-xs text-white font-bold block">LKUT 2024</span>
          <span className="text-[10px] text-white/60">PT Demo BUJK</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        {["SBU Aktif", "Aset ↑12%", "SDM: 45", "ISO 9001"].map((s) => (
          <span key={s} className="bg-white/15 text-white/80 rounded px-2 py-1 text-center">{s}</span>
        ))}
      </div>
    </div>
  );
}

export function CoursesIllustration() {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 space-y-1.5">
      {[
        { level: "Pemula", pct: 100, emoji: "🟢" },
        { level: "Muda", pct: 60, emoji: "🔵" },
        { level: "Madya", pct: 20, emoji: "🟣" },
        { level: "Utama", pct: 0, emoji: "⭐" },
      ].map((l) => (
        <div key={l.level} className="flex items-center gap-2">
          <span className="text-xs">{l.emoji}</span>
          <span className="text-[10px] text-white/80 w-12">{l.level}</span>
          <div className="flex-1 h-1.5 bg-white/10 rounded-full">
            <div className="h-full bg-white/60 rounded-full" style={{ width: `${l.pct}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function GradingIllustration() {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
      <span className="text-3xl font-extrabold text-white tracking-tight">B+</span>
      <div className="flex justify-center gap-1 mt-2">
        {[
          { label: "Fin", val: 82 },
          { label: "Proj", val: 88 },
          { label: "Comp", val: 75 },
          { label: "Risk", val: 70 },
        ].map((p) => (
          <div key={p.label} className="bg-white/15 rounded px-2 py-1">
            <span className="text-[10px] text-white/60 block">{p.label}</span>
            <span className="text-xs text-white font-bold">{p.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function InnovationIllustration() {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 flex gap-2">
      {["💡 Inovasi", "🛒 Marketplace", "🏢 Direktori"].map((item) => (
        <div key={item} className="flex-1 bg-white/15 rounded-lg p-2 text-center">
          <span className="text-xs text-white/90">{item}</span>
        </div>
      ))}
    </div>
  );
}

export function FinishIllustration() {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
      <div className="flex justify-center gap-1 text-2xl mb-1">🎉🚀✨</div>
      <span className="text-xs text-white/80">Semua fitur siap digunakan!</span>
    </div>
  );
}

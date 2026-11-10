import type { ReactNode } from "react";

type Props = { number: string; title?: string; children: ReactNode; variant?: "default" | "hero" };
export default function DeckFrame({ number, title, children, variant = "default" }: Props) {
  return <div className="relative w-screen h-screen overflow-hidden bg-bg text-text font-body">
    <div className="absolute inset-0 deck-grid opacity-30" />
    <div className="absolute left-0 top-0 h-full w-[0.55vw] bg-primary" />
    <div className="absolute right-[5vw] top-0 h-[1.1vh] w-[18vw] bg-accent" />
    <div className="absolute right-[-8vw] bottom-[-22vh] h-[48vh] w-[28vw] rounded-full border-[0.18vw] border-primary/20" />
    {variant === "default" && title ? <header className="absolute left-[6vw] right-[6vw] top-[6vh] z-10">
      <div className="mb-[1.8vh] flex items-center gap-[1vw] text-[1.5vw] font-bold uppercase tracking-[0.18em] text-primary">
        <span>PUB ASPEKINDO</span><span className="h-[0.2vh] w-[5vw] bg-accent" />
      </div>
      <h1 className="max-w-[88vw] font-display text-[3.4vw] font-extrabold leading-[1.05] tracking-[-0.035em] text-text text-balance">{title}</h1>
    </header> : null}
    <main className="relative z-10 h-full">{children}</main>
    <footer className="absolute bottom-[3.6vh] left-[6vw] right-[6vw] z-20 flex items-center justify-between text-[1.5vw] font-bold tracking-[0.12em] text-muted">
      <span>EKOSISTEM KESIAPAN BUJK</span><span className="text-primary">{number} / 18</span>
    </footer>
  </div>;
}

export function Bullet({ children }: { children: ReactNode }) {
  return <div className="flex items-start gap-[1.1vw] text-[1.95vw] leading-[1.3] text-text"><span className="mt-[1.05vh] h-[0.7vh] w-[0.7vh] shrink-0 rotate-45 bg-primary" /><span>{children}</span></div>;
}
export function Panel({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "gold" | "plain" }) {
  const cls = tone === "gold" ? "border-accent/45 bg-accent/10" : tone === "plain" ? "border-white/10 bg-white/[0.035]" : "border-primary/40 bg-primary/10";
  return <div className={"border p-[1.6vw] " + cls}>{children}</div>;
}
export function Tag({ children }: { children: ReactNode }) { return <span className="inline-flex border border-primary/50 bg-primary/10 px-[1vw] py-[0.8vh] text-[1.5vw] font-bold uppercase tracking-[0.12em] text-primary">{children}</span>; }

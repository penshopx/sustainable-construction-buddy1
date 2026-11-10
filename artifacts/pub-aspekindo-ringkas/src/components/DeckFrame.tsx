import type { ReactNode } from "react";

type Props = {
  number: string;
  title?: string;
  children: ReactNode;
  variant?: "default" | "hero";
};

export default function DeckFrame({ number, title, children, variant = "default" }: Props) {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg text-text font-body">
      <div className="absolute inset-0 deck-grid opacity-30" />
      <div className="absolute left-0 top-0 h-full w-[0.55vw] bg-primary" />
      <div className="absolute right-[5vw] top-0 h-[1.1vh] w-[18vw] bg-accent" />
      <div className="absolute right-[-8vw] bottom-[-22vh] h-[48vh] w-[28vw] rounded-full border-[0.18vw] border-primary/20" />
      {variant === "default" && title ? (
        <header className="absolute left-[6vw] right-[6vw] top-[5.5vh] z-10">
          <div className="mb-[1.6vh] flex items-center gap-[1vw] text-[1.5vw] font-bold uppercase tracking-[0.18em] text-primary">
            <span>PUB ASPEKINDO</span>
            <span className="h-[0.2vh] w-[5vw] bg-accent" />
            <span className="text-muted">Versi Ringkas</span>
          </div>
          <h1 className="max-w-[88vw] font-display text-[3.35vw] font-extrabold leading-[1.05] tracking-[-0.035em] text-text text-balance">{title}</h1>
        </header>
      ) : null}
      <main className="relative z-10 h-full">{children}</main>
      <footer className="absolute bottom-[3.3vh] left-[6vw] right-[6vw] z-20 flex items-center justify-between text-[1.5vw] font-bold tracking-[0.12em] text-muted">
        <span>EKOSISTEM KESIAPAN BUJK</span>
        <span className="text-primary">{number} / 06</span>
      </footer>
    </div>
  );
}

export function ClaimStrip({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center border border-accent/45 bg-[#07111f]/92 ${compact ? "gap-[1vw] px-[1.4vw] py-[1.2vh]" : "gap-[1.2vw] px-[1.7vw] py-[1.5vh]"}`}>
      <span className="shrink-0 text-[1.5vw] font-extrabold uppercase tracking-[0.12em] text-accent">Batas klaim</span>
      <span className="text-[1.55vw] font-bold leading-[1.2] text-text">Keputusan resmi tetap berada pada lembaga berwenang.</span>
    </div>
  );
}
import DeckFrame, { ClaimStrip } from "../../components/DeckFrame";

export default function Slide02() {
  return (
    <DeckFrame number="02" title="Satu Payung untuk Ekosistem Layanan Anggota">
      <div className="absolute left-[6vw] right-[6vw] top-[27vh]">
        <div className="grid grid-cols-[1fr_1.35fr_1fr] gap-[1.3vw]">
          <div className="border border-accent/45 bg-accent/10 p-[1.5vw]">
            <div className="text-[1.6vw] font-bold uppercase text-accent">Pemilik konteks</div>
            <div className="mt-[1.3vh] text-[2.15vw] font-extrabold">ASPEKINDO</div>
            <p className="mt-[1vh] text-[1.75vw] leading-[1.25]">organisasi induk dan konteks layanan anggota</p>
          </div>
          <div className="border border-primary/55 bg-primary/12 p-[1.5vw]">
            <div className="text-[1.6vw] font-bold uppercase text-primary">Payung pengalaman</div>
            <div className="mt-[1.3vh] text-[2.5vw] font-extrabold text-primary">PUB ASPEKINDO</div>
            <p className="mt-[1vh] text-[1.85vw] leading-[1.25]">informasi, workspace, pembelajaran, pemetaan, dan pendampingan</p>
          </div>
          <div className="border border-white/15 bg-white/[0.04] p-[1.5vw]">
            <div className="text-[1.6vw] font-bold uppercase text-muted">Produk & kanal</div>
            <div className="mt-[1.3vh] text-[2.05vw] font-extrabold">LKUT–PUB–LSBU</div>
            <p className="mt-[1vh] text-[1.75vw] leading-[1.25]">DokumenProyek, operasional, dan Gustafta</p>
          </div>
        </div>
        <div className="mt-[2.5vh]">
          <ClaimStrip compact />
        </div>
      </div>
    </DeckFrame>
  );
}
import DeckFrame, { ClaimStrip } from "../../components/DeckFrame";

export default function Slide06() {
  return (
    <DeckFrame number="06" title="Usulan Pilot Terbatas Bersama Anggota">
      <div className="absolute left-[6vw] right-[6vw] top-[26vh]">
        <div className="grid grid-cols-4 gap-[1vw]">
          <div className="border border-primary/45 bg-primary/10 p-[1.35vw]"><div className="text-[2.5vw] font-extrabold text-primary">01</div><p className="mt-[1.2vh] text-[1.65vw] font-bold leading-[1.25]">Pilih beberapa BUJK anggota</p></div>
          <div className="border border-white/15 bg-white/[0.04] p-[1.35vw]"><div className="text-[2.5vw] font-extrabold">02</div><p className="mt-[1.2vh] text-[1.65vw] font-bold leading-[1.25]">Tetapkan RACI, SOP review, dan pemilik data</p></div>
          <div className="border border-accent/45 bg-accent/10 p-[1.35vw]"><div className="text-[2.5vw] font-extrabold text-accent">03</div><p className="mt-[1.2vh] text-[1.65vw] font-bold leading-[1.25]">Ukur kelengkapan, partisipasi, progres, dan cakupan 4 SIAP</p></div>
          <div className="border border-primary/45 bg-primary/10 p-[1.35vw]"><div className="text-[2.5vw] font-extrabold text-primary">04</div><p className="mt-[1.2vh] text-[1.65vw] font-bold leading-[1.25]">Perbaiki indikator lalu perluas bertahap</p></div>
        </div>
        <div className="mt-[2.2vh] bg-primary px-[2vw] py-[1.6vh] font-display text-[2.25vw] font-extrabold text-[#07111f]">Arah akhir: budaya siap, belajar, terukur, dan terus membaik.</div>
        <div className="mt-[1.8vh]"><ClaimStrip compact /></div>
      </div>
    </DeckFrame>
  );
}
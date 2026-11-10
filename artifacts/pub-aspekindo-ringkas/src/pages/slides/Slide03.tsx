import DeckFrame, { ClaimStrip } from "../../components/DeckFrame";

export default function Slide03() {
  return (
    <DeckFrame number="03" title="Satu Perjalanan Anggota dari Informasi ke Tindakan">
      <div className="absolute left-[6vw] right-[6vw] top-[27vh]">
        <div className="grid grid-cols-5 gap-[1vw]">
          <div className="border-t-[0.6vh] border-primary bg-white/[0.04] p-[1.25vw]"><div className="text-[2.5vw] font-extrabold text-primary">01</div><div className="mt-[1.5vh] text-[1.68vw] font-bold leading-[1.25]">Temukan informasi dan agenda relevan</div></div>
          <div className="border-t-[0.6vh] border-primary bg-white/[0.04] p-[1.25vw]"><div className="text-[2.5vw] font-extrabold text-primary">02</div><div className="mt-[1.5vh] text-[1.68vw] font-bold leading-[1.25]">Masuk melalui Navigator dan intake</div></div>
          <div className="border-t-[0.6vh] border-accent bg-white/[0.04] p-[1.25vw]"><div className="text-[2.5vw] font-extrabold text-accent">03</div><div className="mt-[1.5vh] text-[1.68vw] font-bold leading-[1.25]">Lengkapi data serta bukti</div></div>
          <div className="border-t-[0.6vh] border-primary bg-white/[0.04] p-[1.25vw]"><div className="text-[2.5vw] font-extrabold text-primary">04</div><div className="mt-[1.5vh] text-[1.68vw] font-bold leading-[1.25]">Belajar melalui LMS native</div></div>
          <div className="border-t-[0.6vh] border-primary bg-white/[0.04] p-[1.25vw]"><div className="text-[2.5vw] font-extrabold text-primary">05</div><div className="mt-[1.5vh] text-[1.68vw] font-bold leading-[1.25]">Ukur posisi pada 4 SIAP</div></div>
        </div>
        <div className="mt-[2.3vh] border-l-[0.5vw] border-accent bg-accent/10 px-[1.8vw] py-[1.5vh] text-[1.75vw] font-bold">Tindak lanjut: LKUT, proyek, risiko, anggaran, dan pembelajaran.</div>
        <div className="mt-[1.8vh]"><ClaimStrip compact /></div>
      </div>
    </DeckFrame>
  );
}
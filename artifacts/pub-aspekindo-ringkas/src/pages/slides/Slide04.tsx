import DeckFrame, { ClaimStrip } from "../../components/DeckFrame";

export default function Slide04() {
  return (
    <DeckFrame number="04" title="Peta Kompetensi 4 SIAP Membaca Posisi Secara Utuh">
      <div className="absolute left-[6vw] right-[6vw] top-[26vh]">
        <div className="grid grid-cols-4 gap-[1vw]">
          <div className="border border-primary/50 bg-primary/10 p-[1.45vw]"><div className="text-[2.15vw] font-extrabold text-primary">Administrasi</div><p className="mt-[1vh] text-[1.7vw] leading-[1.25]">kelengkapan dasar dan tata kelola</p></div>
          <div className="border border-white/15 bg-white/[0.04] p-[1.45vw]"><div className="text-[2.15vw] font-extrabold">Operasi</div><p className="mt-[1vh] text-[1.7vw] leading-[1.25]">pelaksanaan dan pengendalian</p></div>
          <div className="border border-white/15 bg-white/[0.04] p-[1.45vw]"><div className="text-[2.15vw] font-extrabold">Kompetensi</div><p className="mt-[1vh] text-[1.7vw] leading-[1.25]">pembelajaran serta kapasitas organisasi</p></div>
          <div className="border border-accent/50 bg-accent/10 p-[1.45vw]"><div className="text-[2.15vw] font-extrabold text-accent">Pasar</div><p className="mt-[1vh] text-[1.7vw] leading-[1.25]">peluang dan ekosistem proyek</p></div>
        </div>
        <div className="mt-[2.3vh] grid grid-cols-[1.2fr_0.8fr] gap-[1vw]">
          <div className="border-l-[0.5vw] border-primary bg-primary/10 px-[1.8vw] py-[1.5vh] text-[1.8vw] font-bold">Skor bukti dipisahkan dari cakupan data agar hasil tidak menyesatkan.</div>
          <ClaimStrip compact />
        </div>
      </div>
    </DeckFrame>
  );
}
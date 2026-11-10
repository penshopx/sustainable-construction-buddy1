import DeckFrame, { ClaimStrip } from "../../components/DeckFrame";

const base = import.meta.env.BASE_URL;

export default function Slide01() {
  return (
    <DeckFrame number="01" variant="hero">
      <img src={`${base}pub-hero.jpg`} crossOrigin="anonymous" className="absolute inset-0 h-full w-full object-cover" alt="Proyek infrastruktur dan lapisan data" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#07111f] via-[#07111f]/94 to-[#07111f]/35" />
      <div className="absolute left-[6vw] top-[7vh] z-10 text-[1.5vw] font-bold uppercase tracking-[0.2em] text-primary">Ringkasan Eksekutif · PUB ASPEKINDO</div>
      <div className="absolute left-[6vw] top-[21vh] z-10 w-[66vw]">
        <div className="mb-[2.5vh] h-[0.7vh] w-[11vw] bg-accent" />
        <h1 className="font-display text-[4.75vw] font-extrabold leading-[0.98] tracking-[-0.05em] text-white text-balance">Dari Informasi yang Tersebar Menuju Kesiapan yang Terarah</h1>
        <p className="mt-[3.2vh] max-w-[59vw] text-[2.05vw] font-bold leading-[1.3] text-white/85">Anggota membutuhkan jalur yang jelas dari mengetahui kebutuhan menuju tindakan; pengurus membutuhkan gambaran yang konsisten dan dapat ditelusuri.</p>
      </div>
      <div className="absolute bottom-[10vh] left-[6vw] z-20 w-[62vw]">
        <ClaimStrip />
      </div>
    </DeckFrame>
  );
}
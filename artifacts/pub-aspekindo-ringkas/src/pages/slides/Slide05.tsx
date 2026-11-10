import DeckFrame, { ClaimStrip } from "../../components/DeckFrame";

export default function Slide05() {
  return (
    <DeckFrame number="05" title="Nilai bagi Anggota, Pengurus, dan Organisasi">
      <div className="absolute left-[6vw] right-[6vw] top-[26vh]">
        <div className="grid grid-cols-3 gap-[1.2vw]">
          <div className="border border-primary/45 bg-primary/10 p-[1.45vw]"><div className="text-[1.55vw] font-bold uppercase text-primary">Anggota</div><p className="mt-[1.2vh] text-[1.85vw] font-bold leading-[1.25]">jalur lebih jelas dari kebutuhan menuju tindakan</p></div>
          <div className="border border-white/15 bg-white/[0.04] p-[1.45vw]"><div className="text-[1.55vw] font-bold uppercase text-muted">Pengurus</div><p className="mt-[1.2vh] text-[1.85vw] font-bold leading-[1.25]">bahasa pengukuran yang konsisten antaranggota</p></div>
          <div className="border border-accent/45 bg-accent/10 p-[1.45vw]"><div className="text-[1.55vw] font-bold uppercase text-accent">Admin</div><p className="mt-[1.2vh] text-[1.85vw] font-bold leading-[1.25]">program, LMS, dan monitoring dalam satu ekosistem</p></div>
          <div className="col-span-2 border border-white/15 bg-white/[0.04] p-[1.45vw]"><div className="text-[1.55vw] font-bold uppercase text-muted">Organisasi & ekosistem</div><p className="mt-[1.2vh] text-[1.85vw] font-bold leading-[1.25]">pembelajaran terdokumentasi dan fondasi data untuk pembinaan lebih tepat sasaran</p></div>
          <div className="flex items-center justify-center border border-primary/30 bg-primary/10 p-[1.2vw] font-display text-[2.4vw] font-extrabold text-primary">SATU BAHASA KESIAPAN</div>
        </div>
        <div className="mt-[1.8vh]"><ClaimStrip compact /></div>
      </div>
    </DeckFrame>
  );
}
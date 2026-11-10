import { Link } from "react-router-dom";
import PublicInformationHeader from "@/components/PublicInformationHeader";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { usePageMeta } from "@/components/clinic/clinicUi";
import ConsultationWorkspace from "@/components/consultation/ConsultationWorkspace";
import LoginGate from "@/components/advisor/LoginGate";
import { STAGES } from "@/lib/consultationFlow";

export default function Konsultasi() {
  usePageMeta("Konsultasi Terpandu | PUB ASPEKINDO", "Konsultasi terpandu tiga tahap untuk tujuh peran jasa konstruksi: Diagnosis, Eksplorasi, Blueprint.");
  const { user } = useAuth();
  return (
    <div className="min-h-[100dvh] bg-background">
      <PublicInformationHeader backToHome />
      <main>
        <section className="border-b-4 border-pub-amber bg-pub-navy text-white">
          <div className="container mx-auto px-4 py-12 md:py-16">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-pub-amber">PUB ASPEKINDO · Konsultasi terpandu</p>
            <h1 className="mt-4 max-w-3xl font-heading text-4xl font-extrabold leading-[1.05] md:text-5xl">Dari keluhan proyek ke rencana tindak, dalam tiga tahap.</h1>
            <ol className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
              {STAGES.map((s, i) => (
                <li key={s.id} className="border-l-4 border-pub-amber bg-white/5 px-4 py-3">
                  <span className="font-mono text-sm font-bold text-pub-amber">{String(i + 1).padStart(2, "0")}</span>
                  <span className="mt-1 block font-heading text-lg font-bold">{s.label}</span>
                  <span className="text-sm text-white/85">{s.hint}</span>
                </li>
              ))}
            </ol>
            <p className="mt-6 max-w-2xl text-sm text-white/85">Tahap berpindah hanya setelah AI berhasil menjawab. Sesi mengikuti batas layanan AI PUB. Bukan layanan sertifikasi, asesmen, atau perizinan. Butuh analisis angka proyek? Pakai <Link to="/brain-project" className="font-semibold text-pub-amber underline">Brain Project</Link>; butuh operator manusia? Buka <Link to="/klinik-konsultasi" className="font-semibold text-pub-amber underline">Klinik Konsultasi</Link>.</p>
          </div>
        </section>
        <section className="container mx-auto px-4 py-10">
          {user ? <ConsultationWorkspace key={user.id} /> : <LoginGate next="/konsultasi" what="memulai konsultasi" />}
        </section>
      </main>
      <Footer />
    </div>
  );
}

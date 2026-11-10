import { useEffect } from "react";
import AspekindoLearningSection from "@/components/AspekindoLearningSection";
import PublicInformationHeader from "@/components/PublicInformationHeader";
import Footer from "@/components/Footer";

export default function PublicAgendaPage() {
  useEffect(() => {
    document.title = "Agenda Kegiatan PUB | PUB ASPEKINDO";
    const description = "Agenda kegiatan, pembelajaran, dan pengembangan usaha PUB ASPEKINDO untuk pelaku jasa konstruksi.";
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = description;
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <PublicInformationHeader backToHome />
      <main>
        <AspekindoLearningSection standalone />
      </main>
      <Footer />
    </div>
  );
}
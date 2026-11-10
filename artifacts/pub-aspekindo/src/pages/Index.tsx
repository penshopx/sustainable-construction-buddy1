import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { ChevronDown } from "lucide-react";
import HeroSection from "@/components/HeroSection";
import FloatingChatbot from "@/components/FloatingChatbot";
import FloatingLkut from "@/components/FloatingLkut";
import InformationLandingSection from "@/components/InformationLandingSection";

const ProjectVideoSection = lazy(() => import("@/components/ProjectVideoSection"));
const IndustryProblemSection = lazy(() => import("@/components/IndustryProblemSection"));
const TheOneThingSection = lazy(() => import("@/components/TheOneThingSection"));
const ReadinessToolsSection = lazy(() => import("@/components/ReadinessToolsSection"));
const QualityGovernanceSection = lazy(() => import("@/components/QualityGovernanceSection"));
const SkkSection = lazy(() => import("@/components/SkkSection"));
const SiapPubSection = lazy(() => import("@/components/SiapPubSection"));
const ProjectEcosystemSection = lazy(() => import("@/components/ProjectEcosystemSection"));
const AspekindoLearningSection = lazy(() => import("@/components/AspekindoLearningSection"));
const DokumenProyekSection = lazy(() => import("@/components/DokumenProyekSection"));
const SocialProofSection = lazy(() => import("@/components/SocialProofSection"));
const EngineCards = lazy(() => import("@/components/EngineCards"));
const TeamSection = lazy(() => import("@/components/TeamSection"));
const CTASection = lazy(() => import("@/components/CTASection"));
const Footer = lazy(() => import("@/components/Footer"));

const mobileQuery = "(max-width: 767px)";
const subscribeToMobile = (callback: () => void) => {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
};
const getIsMobile = () => window.matchMedia(mobileQuery).matches;

const anchorGroups: Record<string, string> = {
  "video-pub": "pengenalan",
  "masalah-industri": "pengenalan",
  "simulator-kesiapan": "kesiapan",
  "mutu-tata-kelola": "kesiapan",
  "sesi-skk": "kesiapan",
  "siap-pub": "kesiapan",
  "ekosistem-proyek": "layanan",
  "agenda-aspekindo": "layanan",
  "perjalanan-anggota": "tentang",
};

function MobileSectionGroup({
  id,
  title,
  description,
  isMobile,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  description: string;
  isMobile: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      {isMobile && (
        <div className="border-b border-white/15 bg-[hsl(220,65%,11%)] px-5 py-2 text-white">
          <button
            type="button"
            data-testid={`button-expand-${id}`}
            aria-expanded={open}
            aria-controls={`mobile-group-${id}`}
            onClick={onToggle}
            className="flex min-h-16 w-full items-center justify-between gap-4 text-left focus-visible:rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <span>
              <span className="block font-heading text-base font-bold">{title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-white/80">{description}</span>
            </span>
            <ChevronDown className={`h-5 w-5 shrink-0 text-pub-amber transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
        </div>
      )}
      <div id={`mobile-group-${id}`} hidden={isMobile && !open}>
        {(!isMobile || open) && children}
      </div>
    </div>
  );
}

function LazySection({
  children,
  minHeight = 420,
}: {
  children: React.ReactNode;
  minHeight?: number;
}) {
  return (
    <Suspense
      fallback={
        <div
          style={{ minHeight }}
          aria-label="Memuat bagian halaman"
          aria-busy="true"
        />
      }
    >
      {children}
    </Suspense>
  );
}

const Index = () => {
  const isMobile = useSyncExternalStore(subscribeToMobile, getIsMobile, () => false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => {
    if (!isMobile) return;

    let observer: MutationObserver | undefined;
    const openHashTarget = () => {
      observer?.disconnect();
      const hash = decodeURIComponent(window.location.hash.slice(1));
      const group = anchorGroups[hash];
      if (!group) return;
      setOpenGroup(group);

      // Lazy sections mount after the group opens; scroll when the anchor exists.
      const scrollToTarget = () => {
        const target = document.getElementById(hash);
        if (target && !target.closest("[hidden]")) {
          target.scrollIntoView();
          observer?.disconnect();
          return true;
        }
        return false;
      };
      if (!scrollToTarget()) {
        observer = new MutationObserver(scrollToTarget);
        observer.observe(document.body, { childList: true, subtree: true });
      }
    };

    openHashTarget();
    window.addEventListener("hashchange", openHashTarget);
    return () => {
      observer?.disconnect();
      window.removeEventListener("hashchange", openHashTarget);
    };
  }, [isMobile]);

  const toggleGroup = (group: string) => setOpenGroup((current) => current === group ? null : group);

  return (
    <main className="min-h-screen overflow-x-hidden">
      {/* A — ATTENTION: Hero with shocking industry data */}
      <HeroSection />

      {/* Official industry and PUB publication center */}
      <InformationLandingSection />

      <div id="jelajahi-bagian" className="scroll-mt-4 bg-[hsl(220,65%,11%)] px-5 pt-5 text-white md:hidden">
        <h2 className="font-heading text-lg font-bold">Jelajahi bagian PUB</h2>
        <p className="pb-3 text-sm text-white/80">Pilih topik untuk melihat informasi selengkapnya.</p>
      </div>

      <MobileSectionGroup id="pengenalan" title="Kenali PUB" description="Konteks industri dan pendekatan PUB" isMobile={isMobile} open={openGroup === "pengenalan"} onToggle={() => toggleGroup("pengenalan")}>
        <LazySection minHeight={480}><ProjectVideoSection /></LazySection>
        <LazySection><IndustryProblemSection /></LazySection>
        <LazySection><TheOneThingSection /></LazySection>
      </MobileSectionGroup>

      <MobileSectionGroup id="kesiapan" title="Kesiapan & tata kelola" description="Alat bantu, mutu, SKK, dan pembelajaran terstruktur" isMobile={isMobile} open={openGroup === "kesiapan"} onToggle={() => toggleGroup("kesiapan")}>
        <LazySection><ReadinessToolsSection /></LazySection>
        <LazySection><QualityGovernanceSection /></LazySection>
        <LazySection><SkkSection /></LazySection>
        <LazySection><SiapPubSection /></LazySection>
      </MobileSectionGroup>

      <MobileSectionGroup id="layanan" title="Layanan & kegiatan" description="Ekosistem proyek, agenda, dan dokumen" isMobile={isMobile} open={openGroup === "layanan"} onToggle={() => toggleGroup("layanan")}>
        <LazySection><ProjectEcosystemSection /></LazySection>
        <LazySection><AspekindoLearningSection /></LazySection>
        <LazySection><DokumenProyekSection /></LazySection>
      </MobileSectionGroup>

      <MobileSectionGroup id="tentang" title="Tentang ASPEKINDO" description="Jejaring, perjalanan anggota, dan tim" isMobile={isMobile} open={openGroup === "tentang"} onToggle={() => toggleGroup("tentang")}>
        <LazySection><SocialProofSection /></LazySection>
        <LazySection><EngineCards /></LazySection>
        <LazySection minHeight={560}><TeamSection /></LazySection>
      </MobileSectionGroup>

      {/* A — ACTION: Urgent CTA */}
      <LazySection>
        <CTASection />
      </LazySection>

      <LazySection minHeight={260}>
        <Footer />
      </LazySection>
      {/* Kiri: Helpdesk aplikasi */}
      <FloatingChatbot variant="landing" />
      {/* Kanan: produk asli ASPEKINDO */}
      <FloatingLkut />
    </main>
  );
};

export default Index;

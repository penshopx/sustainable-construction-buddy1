import { lazy, Suspense } from "react";
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
  return (
    <main className="min-h-screen overflow-x-hidden">
      {/* A — ATTENTION: Hero with shocking industry data */}
      <HeroSection />

      {/* Official industry and PUB publication center */}
      <InformationLandingSection />

      {/* Motion piece: 4 Siap menghadapi perubahan industri */}
      <LazySection minHeight={480}>
        <ProjectVideoSection />
      </LazySection>

      {/* I — INTEREST: Deep dive into real problems + public data */}
      <LazySection>
        <IndustryProblemSection />
      </LazySection>

      {/* D — DESIRE: The One Thing solution + before/after + features */}
      <LazySection>
        <TheOneThingSection />
      </LazySection>

      {/* Readiness tools for SBU and LKUT preparation */}
      <LazySection>
        <ReadinessToolsSection />
      </LazySection>

      {/* Quality, anti-bribery governance, and legal support */}
      <LazySection>
        <QualityGovernanceSection />
      </LazySection>

      {/* Supporting access for the SKK session */}
      <LazySection>
        <SkkSection />
      </LazySection>

      {/* Learning session: implementation of PUB through structured learning */}
      <LazySection>
        <SiapPubSection />
      </LazySection>

      {/* From 4 SIAP readiness into project management and opportunities */}
      <LazySection>
        <ProjectEcosystemSection />
      </LazySection>

      {/* ASPEKINDO's own learning activities and public agenda */}
      <LazySection>
        <AspekindoLearningSection />
      </LazySection>

      {/* Siap Proyek: third-party document administration service */}
      <LazySection>
        <DokumenProyekSection />
      </LazySection>

      {/* Social proof: logos, legal basis, reach */}
      <LazySection>
        <SocialProofSection />
      </LazySection>

      {/* System architecture */}
      <LazySection>
        <EngineCards />
      </LazySection>

      {/* Team credibility */}
      <LazySection minHeight={560}>
        <TeamSection />
      </LazySection>

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

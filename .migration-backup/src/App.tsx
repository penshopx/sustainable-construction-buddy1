import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Navigate } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/auth-provider";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AdminGuard from "./components/AdminGuard";
import SuperAdminGuard from "./components/SuperAdminGuard";
import DashboardLayout from "./components/DashboardLayout";
import NotFound from "./pages/NotFound";
import PublicChatbotPage from "./pages/PublicChatbotPage";
import PublicHelpdeskPage from "./pages/PublicHelpdeskPage";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Assessment = lazy(() => import("./pages/Assessment"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Generator = lazy(() => import("./pages/Generator"));
const Mentor = lazy(() => import("./pages/Mentor"));
const Profile = lazy(() => import("./pages/Profile"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const CorporateDashboard = lazy(() => import("./pages/admin/CorporateDashboard"));
const AdminPancekVerification = lazy(() => import("./pages/admin/AdminPancekVerification"));
const Certificates = lazy(() => import("./pages/Certificates"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Projects = lazy(() => import("./pages/Projects"));
const RiskRegister = lazy(() => import("./pages/RiskRegister"));
const BudgetTracker = lazy(() => import("./pages/BudgetTracker"));
const K3Checklist = lazy(() => import("./pages/K3Checklist"));
const LkutReport = lazy(() => import("./pages/LkutReport"));
const PerformanceGrade = lazy(() => import("./pages/PerformanceGrade"));
const ComplianceTracker = lazy(() => import("./pages/ComplianceTracker"));
const SmapDashboard = lazy(() => import("./pages/SmapDashboard"));
const Notifications = lazy(() => import("./pages/Notifications"));
const AdminRequests = lazy(() => import("./pages/admin/AdminRequests"));
const Install = lazy(() => import("./pages/Install"));
const Innovation = lazy(() => import("./pages/Innovation"));
const AdminInnovationReview = lazy(() => import("./pages/admin/AdminInnovationReview"));
const ProposalDetail = lazy(() => import("./pages/ProposalDetail"));
const PubPrograms = lazy(() => import("./pages/Programs"));
const ProgramDetail = lazy(() => import("./pages/ProgramDetail"));
const PublicPrograms = lazy(() => import("./pages/PublicPrograms"));
const PublicProgramDetail = lazy(() => import("./pages/PublicProgramDetail"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const CompanyDirectory = lazy(() => import("./pages/CompanyDirectory"));
const CompanyDetail = lazy(() => import("./pages/CompanyDetail"));
const HelpdeskAI = lazy(() => import("./pages/HelpdeskAI"));
const MyOrders = lazy(() => import("./pages/MyOrders"));
const MyProducts = lazy(() => import("./pages/MyProducts"));
const AdminMarketplace = lazy(() => import("./pages/admin/AdminMarketplace"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminSalesStats = lazy(() => import("./pages/admin/AdminSalesStats"));
const AdminQuizQuestions = lazy(() => import("./pages/admin/AdminQuizQuestions"));
const AdminModules = lazy(() => import("./pages/admin/AdminModules"));
const PancekAssessment = lazy(() => import("./pages/PancekAssessment"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminCertificates = lazy(() => import("./pages/admin/AdminCertificates"));
const AdminQuestions = lazy(() => import("./pages/admin/AdminQuestions"));
const AdminRoleConflicts = lazy(() => import("./pages/admin/AdminRoleConflicts"));
const AdminSummary = lazy(() => import("./pages/admin/AdminSummary"));
const AdminMarketingBrief = lazy(() => import("./pages/admin/AdminMarketingBrief"));
const AdminAspekindoAgenda = lazy(() => import("./pages/admin/AdminAspekindoAgenda"));
const PitchDeck = lazy(() => import("./pages/PitchDeck"));
const PubAspekindoVideo = lazy(() => import("./pages/PubAspekindoVideo"));
const ReadinessSimulatorPage = lazy(() => import("./pages/ReadinessSimulatorPage"));
const LearningHub = lazy(() => import("./pages/LearningHub"));
const AspekindoLmsCourseDetail = lazy(() => import("./pages/AspekindoLmsNative").then(({ AspekindoLmsCourseDetail: component }) => ({ default: component })));
const AspekindoLms = lazy(() => import("./pages/AspekindoLms"));
const AdminAspekindoLms = lazy(() => import("./pages/admin/AdminAspekindoLms"));
const AdminAspekindoLmsNative = lazy(() => import("./pages/admin/AdminAspekindoLmsNative"));
const AdminAccessManagement = lazy(() => import("./pages/admin/AdminAccessManagement"));
const InformationCenter = lazy(() => import("./pages/InformationCenter"));
const InformationDetail = lazy(() => import("./pages/InformationDetail"));
const AdminInformationCenter = lazy(() => import("./pages/admin/AdminInformationCenter"));
const PublicAgendaPage = lazy(() => import("./pages/PublicAgendaPage"));
const SiapCompetencyMap = lazy(() => import("./pages/SiapCompetencyMap"));
const AdminAspekindoLmsCourses = lazy(() => import("./pages/admin/AdminAspekindoLmsCourses"));
const PublicCourseLanding = lazy(() => import("./pages/PublicCourseLanding"));

const queryClient = new QueryClient();

function PageLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center bg-background px-4 text-muted-foreground">
      <div className="flex items-center gap-3 text-sm font-medium">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-pub-sky/30 border-t-pub-sky" />
        Memuat halaman...
      </div>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Suspense fallback={<PageLoading />}>
            <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/informasi" element={<InformationCenter />} />
            <Route path="/informasi/:slug" element={<InformationDetail />} />
            <Route path="/agenda-pub" element={<PublicAgendaPage />} />
            <Route path="/kursus/:slug" element={<PublicCourseLanding />} />
            <Route path="/simulator-sbu" element={<ReadinessSimulatorPage kind="sbu" />} />
            <Route path="/simulator-lkut" element={<ReadinessSimulatorPage kind="lkut" />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/dashboard" element={<DashboardLayout><Dashboard /></DashboardLayout>} />
            <Route path="/assessment" element={<DashboardLayout><Assessment /></DashboardLayout>} />
            <Route path="/courses" element={<DashboardLayout><LearningHub /></DashboardLayout>} />
            <Route path="/aspekindo-lms/kursus/:courseId" element={<DashboardLayout><AspekindoLmsCourseDetail /></DashboardLayout>} />
            <Route path="/aspekindo-lms" element={<DashboardLayout><LearningHub /></DashboardLayout>} />
            <Route path="/aspekindo-aktivitas" element={<DashboardLayout><AspekindoLms /></DashboardLayout>} />
            <Route path="/mentor" element={<DashboardLayout><Mentor /></DashboardLayout>} />
            <Route path="/analytics" element={<DashboardLayout><Analytics /></DashboardLayout>} />
            <Route path="/siap-kompetensi" element={<DashboardLayout><SiapCompetencyMap /></DashboardLayout>} />
            <Route path="/generator" element={<DashboardLayout><Generator /></DashboardLayout>} />
            <Route path="/profile" element={<DashboardLayout><Profile /></DashboardLayout>} />
            <Route path="/certificates" element={<DashboardLayout><Certificates /></DashboardLayout>} />
            <Route path="/leaderboard" element={<DashboardLayout><Leaderboard /></DashboardLayout>} />
            <Route path="/notifications" element={<DashboardLayout><Notifications /></DashboardLayout>} />
            <Route path="/projects" element={<DashboardLayout><Projects /></DashboardLayout>} />
            <Route path="/risk-register" element={<DashboardLayout><RiskRegister /></DashboardLayout>} />
            <Route path="/budget-tracker" element={<DashboardLayout><BudgetTracker /></DashboardLayout>} />
            <Route path="/k3-checklist" element={<DashboardLayout><K3Checklist /></DashboardLayout>} />
            <Route path="/lkut" element={<DashboardLayout><LkutReport /></DashboardLayout>} />
            <Route path="/grading" element={<DashboardLayout><PerformanceGrade /></DashboardLayout>} />
            <Route path="/compliance" element={<DashboardLayout><ComplianceTracker /></DashboardLayout>} />
            <Route path="/smap" element={<DashboardLayout><SmapDashboard /></DashboardLayout>} />
            <Route path="/pancek" element={<DashboardLayout><PancekAssessment /></DashboardLayout>} />
            <Route path="/marketplace" element={<DashboardLayout><Marketplace /></DashboardLayout>} />
            <Route path="/direktori" element={<DashboardLayout><CompanyDirectory /></DashboardLayout>} />
            <Route path="/direktori/:companyId" element={<DashboardLayout><CompanyDetail /></DashboardLayout>} />
            <Route path="/helpdesk" element={<DashboardLayout><HelpdeskAI /></DashboardLayout>} />
            <Route path="/ai-helpdesk" element={<Navigate to="/dashboard" replace />} />
            <Route path="/pesanan" element={<DashboardLayout><MyOrders /></DashboardLayout>} />
            <Route path="/produk-saya" element={<DashboardLayout><MyProducts /></DashboardLayout>} />
            <Route path="/my-products" element={<Navigate to="/produk-saya" replace />} />
            <Route path="/admin" element={<DashboardLayout><AdminGuard><AdminDashboard /></AdminGuard></DashboardLayout>} />
            <Route path="/corporate" element={<DashboardLayout><AdminGuard><CorporateDashboard /></AdminGuard></DashboardLayout>} />
            <Route path="/admin/pancek" element={<DashboardLayout><AdminGuard><AdminPancekVerification /></AdminGuard></DashboardLayout>} />
            <Route path="/admin/inovasi" element={<DashboardLayout><AdminGuard><AdminInnovationReview /></AdminGuard></DashboardLayout>} />
            <Route path="/admin/marketplace" element={<DashboardLayout><AdminGuard><AdminMarketplace /></AdminGuard></DashboardLayout>} />
            <Route path="/admin/pesanan" element={<DashboardLayout><AdminGuard><AdminOrders /></AdminGuard></DashboardLayout>} />
            <Route path="/admin/statistik" element={<DashboardLayout><AdminGuard><AdminSalesStats /></AdminGuard></DashboardLayout>} />
            <Route path="/admin/quiz" element={<DashboardLayout><AdminGuard><AdminQuizQuestions /></AdminGuard></DashboardLayout>} />
            <Route path="/admin/modules" element={<DashboardLayout><AdminGuard><AdminModules /></AdminGuard></DashboardLayout>} />
            <Route path="/admin/users" element={<DashboardLayout><AdminGuard><AdminUsers /></AdminGuard></DashboardLayout>} />
            <Route path="/admin/certificates" element={<DashboardLayout><AdminGuard><AdminCertificates /></AdminGuard></DashboardLayout>} />
            <Route path="/admin/questions" element={<DashboardLayout><AdminGuard><AdminQuestions /></AdminGuard></DashboardLayout>} />
            <Route path="/admin/role-conflicts" element={<DashboardLayout><AdminGuard><AdminRoleConflicts /></AdminGuard></DashboardLayout>} />
            <Route path="/admin/rangkuman" element={<DashboardLayout><AdminGuard><AdminSummary /></AdminGuard></DashboardLayout>} />
            <Route path="/admin/permintaan" element={<DashboardLayout><SuperAdminGuard><AdminRequests /></SuperAdminGuard></DashboardLayout>} />
            <Route path="/admin/akses" element={<DashboardLayout><SuperAdminGuard><AdminAccessManagement /></SuperAdminGuard></DashboardLayout>} />
            <Route path="/admin/marketing-brief" element={<DashboardLayout><AdminGuard><AdminMarketingBrief /></AdminGuard></DashboardLayout>} />
            <Route path="/admin/aspekindo-agenda" element={<DashboardLayout><AdminGuard><AdminAspekindoAgenda /></AdminGuard></DashboardLayout>} />
            <Route path="/admin/aspekindo-lms" element={<DashboardLayout><AdminGuard><AdminAspekindoLms /></AdminGuard></DashboardLayout>} />
            <Route path="/admin/aspekindo-lms/kursus" element={<DashboardLayout><AdminGuard><AdminAspekindoLmsCourses /></AdminGuard></DashboardLayout>} />
            <Route path="/admin/lms-aspekindo" element={<DashboardLayout><AdminGuard><AdminAspekindoLmsNative /></AdminGuard></DashboardLayout>} />
            <Route path="/admin/informasi" element={<DashboardLayout><AdminGuard><AdminInformationCenter /></AdminGuard></DashboardLayout>} />
            <Route path="/inovasi" element={<DashboardLayout><Innovation /></DashboardLayout>} />
            <Route path="/inovasi/proposal/:id" element={<DashboardLayout><ProposalDetail /></DashboardLayout>} />
            <Route path="/program-kegiatan" element={<PublicPrograms />} />
            <Route path="/program-kegiatan/:id" element={<PublicProgramDetail />} />
            <Route path="/admin/program-kegiatan" element={<DashboardLayout><AdminGuard><PubPrograms /></AdminGuard></DashboardLayout>} />
            <Route path="/admin/program-kegiatan/:id" element={<DashboardLayout><AdminGuard><ProgramDetail /></AdminGuard></DashboardLayout>} />
            <Route path="/install" element={<Install />} />
            <Route path="/pitch-deck" element={<PitchDeck />} />
            <Route path="/video-pub-aspekindo" element={<PubAspekindoVideo />} />
            <Route path="/helpdesk-standalone" element={<PublicHelpdeskPage />} />
            <Route path="/chatbot/:token" element={<PublicChatbotPage />} />
            <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

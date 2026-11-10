import {
  LayoutDashboard,
  ClipboardCheck,
  GraduationCap,
  BookOpen,
  User,
  Bell,
  BarChart3,
  FileText,
  MessageCircle,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Award,
  Trophy,
  FolderKanban,
  DollarSign,
  HardHat,
  Building2,
  Briefcase,
  Lightbulb,
  CalendarDays,
  Store,
  Bot,
  ShoppingBag,
  Package,
  Gauge,
  Newspaper,
  ChevronDown,
  ExternalLink,
  CircleHelp,
  ScanText,
  BrainCircuit,
  Compass,
  type LucideIcon,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { LogoutButton } from "@/components/LogoutButton";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import logoPub from "@/assets/logo-pub-new.png";
import { motion } from "framer-motion";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar-context";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Top-level standalone items
const topItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
];

// Data Operasional (sumber data input)
const dataOperasionalItems = [
  { title: "Data LKUT", url: "/lkut", icon: FileText },
  { title: "LKUT Simulator", url: "https://asset-linker-esterkristian26.replit.app/", icon: FileText, external: true },
  { title: "Project Workspace", url: "/projects", icon: FolderKanban },
  { title: "Sistem Manajemen Proyek", url: "https://sistem-manajemen-proyek-konstruksi.replit.app", icon: FolderKanban, external: true },
  { title: "Budget Tracker", url: "/budget-tracker", icon: DollarSign },
  { title: "Risk Register", url: "/risk-register", icon: Shield },
  { title: "K3 Checklist", url: "/k3-checklist", icon: HardHat },
  { title: "SMAP", url: "/smap", icon: ShieldCheck },
  { title: "PANCEK", url: "/pancek", icon: ShieldAlert },
  { title: "DokumenProyek", url: "https://dokumenproyek.com", icon: FileText, external: true },
];

// Analisa & Penilaian (hasil olahan dari data)
const analisaItems = [
  { title: "Compliance Tracker", url: "/compliance", icon: ShieldCheck },
  { title: "Performance Grade", url: "/grading", icon: BarChart3 },
  { title: "Simulator Kesiapan SBU", url: "/simulator-sbu", icon: Gauge },
  { title: "Simulator Kesiapan LKUT", url: "/simulator-lkut", icon: FileText },
];

// Kompetensi & Pembelajaran group
const learningSubItems = [
  { title: "Pre-test Assessment", url: "/assessment", icon: ClipboardCheck },
  { title: "Pusat Pembelajaran PUB", url: "/courses", icon: GraduationCap },
  { title: "LMS ASPEKINDO", url: "/aspekindo-lms", icon: BookOpen },
  { title: "Peta Kompetensi 4 SIAP", url: "/siap-kompetensi", icon: Gauge },
  { title: "DokumenProyek (eksternal)", url: "https://lms.dokumenproyek.com", icon: GraduationCap, external: true },
  { title: "Mentor Digital", url: "/mentor", icon: MessageCircle },
  { title: "Sertifikat", url: "/certificates", icon: Award },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Leaderboard", url: "/leaderboard", icon: Trophy },
];

// Komunitas & Bisnis group
const communitySubItems = [
  { title: "Ruang Simpan PUB", url: "/ruang-simpan/", icon: FolderKanban, fullPage: true },
  { title: "Bedah Dokumen", url: "/bedah-dokumen", icon: ScanText },
  { title: "Klinik Konsultasi", url: "/klinik-konsultasi", icon: MessageCircle },
  { title: "Konsultasi Terpandu", url: "/konsultasi", icon: Compass },
  { title: "Brain Project", url: "/brain-project", icon: BrainCircuit },
  { title: "Pusat Informasi", url: "/informasi", icon: Newspaper },
  { title: "Inovasi PUB", url: "/inovasi", icon: Lightbulb },
  { title: "Program & Kegiatan", url: "/program-kegiatan", icon: CalendarDays },
  { title: "Bukti Kegiatan PUB", url: "/aspekindo-aktivitas", icon: CalendarDays },
  { title: "Marketplace", url: "/marketplace", icon: Store },
  { title: "Direktori Perusahaan", url: "/direktori", icon: Building2 },
  { title: "Pakar Cerdas", url: "/helpdesk", icon: Bot },
  { title: "Pesanan Saya", url: "/pesanan", icon: ShoppingBag },
  { title: "Produk Saya", url: "/produk-saya", icon: Package },
];

// Bottom items
const bottomItems = [
  { title: "Pusat Bantuan", url: "/bantuan#mulai", icon: CircleHelp },
  { title: "Notifikasi", url: "/notifications", icon: Bell },
  { title: "Profil Saya", url: "/profile", icon: User },
];

const adminItems = [
  { title: "Corporate Dashboard", url: "/corporate", icon: Building2 },
  { title: "Pusat Informasi", url: "/admin/informasi", icon: Newspaper },
  { title: "Agenda ASPEKINDO", url: "/admin/aspekindo-agenda", icon: CalendarDays },
  { title: "Operasi Kegiatan PUB", url: "/admin/aspekindo-lms", icon: CalendarDays },
  { title: "Authoring LMS ASPEKINDO", url: "/admin/aspekindo-lms/kursus", icon: BookOpen },
  { title: "Kelola LMS ASPEKINDO", url: "/admin/lms-aspekindo", icon: GraduationCap },
  { title: "Operasi Program & Peserta", url: "/admin/program-kegiatan", icon: CalendarDays },
  { title: "Verifikasi PANCEK", url: "/admin/pancek", icon: ShieldAlert },
  { title: "Review Inovasi", url: "/admin/inovasi", icon: Lightbulb },
  { title: "Kelola Marketplace", url: "/admin/marketplace", icon: Store },
  { title: "Kelola Pesanan", url: "/admin/pesanan", icon: ShoppingBag },
  { title: "Statistik Penjualan", url: "/admin/statistik", icon: BarChart3 },
  { title: "Kelola Modul Pembelajaran", url: "/admin/modules", icon: GraduationCap },
  { title: "Kelola Soal Kuis", url: "/admin/quiz", icon: ClipboardCheck },
  { title: "Kelola Pengguna", url: "/admin/users", icon: Briefcase },
  { title: "Kelola Sertifikat", url: "/admin/certificates", icon: Award },
  { title: "Bank Soal", url: "/admin/questions", icon: ClipboardCheck },
  { title: "Konflik Peran", url: "/admin/role-conflicts", icon: ShieldAlert },
  { title: "Rangkuman Platform", url: "/admin/rangkuman", icon: BarChart3 },
  { title: "Brief Marketing", url: "/admin/marketing-brief", icon: Briefcase },
  { title: "Antrean Klinik Konsultasi", url: "/admin/klinik-konsultasi", icon: MessageCircle },
  { title: "Panel Admin", url: "/admin", icon: Shield },
];

type SidebarItem = { title: string; url: string; icon: LucideIcon; external?: boolean; fullPage?: boolean };

function NavItem({ item, collapsed }: { item: SidebarItem; collapsed: boolean }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <NavLink
          to={item.url}
          end
          className="hover:bg-sidebar-accent/50"
          activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
        >
          <item.icon className="mr-2 h-4 w-4" />
          {!collapsed && <span>{item.title}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function CollapsibleGroup({
  label,
  icon: Icon,
  items,
  collapsed,
  currentPath,
}: {
  label: string;
  icon: LucideIcon;
  items: SidebarItem[];
  collapsed: boolean;
  currentPath: string;
}) {
  const isActive = items.some((i) => currentPath.startsWith(i.url));

  return (
    <Collapsible defaultOpen={isActive} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton className={`hover:bg-sidebar-accent/50 ${isActive ? "text-sidebar-primary font-semibold" : ""}`}>
            <Icon className="mr-2 h-4 w-4" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">{label}</span>
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </>
            )}
          </SidebarMenuButton>
        </CollapsibleTrigger>
        {!collapsed && (
          <CollapsibleContent>
            <SidebarMenuSub>
              {items.map((item) => (
                <SidebarMenuSubItem key={item.title}>
                  <SidebarMenuSubButton asChild>
                    {item.fullPage ? (
                      <a href={item.url} className="flex items-center rounded-md px-2 py-2 hover:bg-sidebar-accent/50">
                        <item.icon className="mr-2 h-3.5 w-3.5" /><span>{item.title}</span>
                      </a>
                    ) : item.external ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:bg-sidebar-accent/50"
                      >
                        <item.icon className="mr-2 h-3.5 w-3.5" />
                        <span className="flex-1">{item.title}</span>
                        <ExternalLink className="ml-auto h-3 w-3 opacity-60" />
                      </a>
                    ) : (
                      <NavLink
                        to={item.url}
                        end
                        className="hover:bg-sidebar-accent/50"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <item.icon className="mr-2 h-3.5 w-3.5" />
                        <span>{item.title}</span>
                      </NavLink>
                    )}
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        )}
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;
  const { profile } = useAuth();
  const { isAdmin } = useAdmin();
  const { isSuperAdmin } = useSuperAdmin();
  const visibleAdminItems = isSuperAdmin
    ? [
        ...adminItems,
        { title: "Kelola Akses Admin", url: "/admin/akses", icon: ShieldCheck },
        { title: "Permintaan Admin", url: "/admin/permintaan", icon: ShieldCheck },
      ]
    : adminItems;

  return (
    <Sidebar collapsible="icon">
      <div className="flex flex-col items-center gap-2 p-4 border-b border-sidebar-border">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05, filter: "drop-shadow(0 0 20px hsl(var(--pub-amber) / 0.6))" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={`${collapsed ? "w-10 h-10" : "w-20 h-20"} flex items-center justify-center cursor-pointer`}
        >
          <img
            src={logoPub}
            alt="PUB ASPEKINDO"
            className={`${collapsed ? "w-10 h-10" : "w-20 h-20"} object-contain transition-transform duration-300`}
            style={{ imageRendering: "auto" }}
          />
        </motion.div>
        {!collapsed && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3, ease: "easeOut" }}
            className="text-lg font-extrabold font-heading tracking-wider text-pub-amber uppercase"
          >
            PUB ASPEKINDO
          </motion.p>
        )}
      </div>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Dashboard */}
              {topItems.map((item) => (
                <NavItem key={item.title} item={item} collapsed={collapsed} />
              ))}

              {/* Data Operasional */}
              <CollapsibleGroup
                label="Data Operasional"
                icon={FileText}
                items={dataOperasionalItems}
                collapsed={collapsed}
                currentPath={currentPath}
              />

              {/* Analisa & Penilaian */}
              <CollapsibleGroup
                label="Analisa & Penilaian"
                icon={BarChart3}
                items={analisaItems}
                collapsed={collapsed}
                currentPath={currentPath}
              />

              {/* Kompetensi & Pembelajaran */}
              <CollapsibleGroup
                label="Kompetensi & Pembelajaran"
                icon={GraduationCap}
                items={learningSubItems}
                collapsed={collapsed}
                currentPath={currentPath}
              />

              {/* Komunitas & Bisnis */}
              <CollapsibleGroup
                label="Komunitas & Bisnis"
                icon={Store}
                items={communitySubItems}
                collapsed={collapsed}
                currentPath={currentPath}
              />

              {/* Bottom items */}
              {bottomItems.map((item) => (
                <NavItem key={item.title} item={item} collapsed={collapsed} />
              ))}

              {/* Admin */}
              {isAdmin && (
                <CollapsibleGroup
                  label="Admin Panel"
                  icon={Shield}
                  items={visibleAdminItems}
                  collapsed={collapsed}
                  currentPath={currentPath}
                />
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {profile && (
          <div className="px-4 py-2 border-t border-sidebar-border">
            {!collapsed ? (
              <>
                <p className="text-xs text-sidebar-foreground/70 font-body truncate">{profile.full_name || "User"}</p>
                <p className="text-xs text-sidebar-primary font-heading">{profile.current_level}</p>
                {profile.position && (
                  <div className="mt-1.5 flex items-center gap-1.5 px-2 py-1 rounded-md bg-pub-amber/10 border border-pub-amber/20">
                    <Briefcase className="w-3 h-3 text-pub-amber shrink-0" />
                    <p className="text-[10px] text-pub-amber font-heading font-semibold truncate leading-tight">
                      {profile.position.replace("Penanggung Jawab Badan Usaha (PJBU) / Direktur", "PJBU / Direktur").replace("Penanggung Jawab Teknik (PJT)", "PJT").replace("Penanggung Jawab Subklasifikasi (PJSKBU)", "PJSKBU").replace("Manajer Logistik & Rantai Pasok", "Mgr. Logistik").replace("Manajer Pengadaan / Tender", "Mgr. Pengadaan").replace("Manajer Administrasi", "Mgr. Administrasi").replace("Manajer Keuangan", "Mgr. Keuangan")}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex justify-center" title={profile.position || profile.current_level}>
                <Briefcase className="w-4 h-4 text-pub-amber" />
              </div>
            )}
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <LogoutButton collapsed={collapsed} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

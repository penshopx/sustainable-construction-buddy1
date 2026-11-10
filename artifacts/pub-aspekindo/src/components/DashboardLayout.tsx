import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import FloatingChatbot from "@/components/FloatingChatbot";
import FloatingLkut from "@/components/FloatingLkut";
import { ContextualHelpLink } from "@/components/ContextualHelpLink";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
    if (!loading && user && !localStorage.getItem("pub_onboarding_done")) {
      navigate("/onboarding");
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="min-w-0 flex-1 flex flex-col">
          <header className="h-auto py-2 md:py-3 flex items-center justify-between border-b border-border bg-card px-3 md:px-4">
            <div className="flex items-center min-w-0">
              <SidebarTrigger className="mr-2 md:mr-4 shrink-0" />
              <div className="leading-tight min-w-0">
                <motion.h1
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="text-sm md:text-4xl font-extrabold font-heading uppercase tracking-wide"
                >
                  <span className="text-foreground">PENGEMBANGAN</span>{" "}
                  <span className="bg-gradient-to-r from-pub-amber to-pub-amber-light bg-clip-text text-transparent">USAHA BERKELANJUTAN</span>
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
                  className="text-base md:text-5xl font-black font-heading uppercase tracking-wider mt-0.5 md:mt-1 bg-gradient-to-r from-pub-navy via-pub-sky to-pub-navy bg-clip-text text-transparent dark:from-pub-sky dark:via-pub-amber-light dark:to-pub-sky"
                >
                  (PUB ASPEKINDO)
                </motion.p>
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-3 shrink-0">
              <ContextualHelpLink />
              <NotificationBell />
              <ThemeToggle />
            </div>
          </header>
          <main className="min-w-0 flex-1 p-3 md:p-6 bg-background overflow-auto">
            {children}
          </main>
        </div>
        {/* Kiri: Helpdesk aplikasi */}
        <FloatingChatbot variant="dashboard" />
        {/* Kanan: produk asli ASPEKINDO */}
        <FloatingLkut />
      </div>
    </SidebarProvider>
  );
}

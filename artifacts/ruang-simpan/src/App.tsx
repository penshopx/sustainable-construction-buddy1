import type { ComponentType } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch, Redirect, Router } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell, Brand } from "@/components/app-shell";
import { ErrorBoundary } from "@/components/error-boundary";
import { PubAuthProvider, usePubAuth } from "@/lib/pub-auth";
import PortalPage from "@/pages/portal";
import ProfilePage from "@/pages/profile";
import AssistantsPage from "@/pages/assistants";
import ActivityPage from "@/pages/activity";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: true, retry: 1 } } });
function PubLogin() {
  const { error } = usePubAuth();
  return <main className="min-h-screen grid place-items-center p-6"><section className="max-w-lg space-y-6 rounded-2xl border border-border bg-card p-8">
    <Brand /><h1 className="text-3xl font-bold">Pusat data bisnis PUB ASPEKINDO</h1>
    <p className="text-muted-foreground">Profil perusahaan, dokumen resmi, dan acuan AI PUB berada di Ruang Simpan. Gunakan akun PUB Anda—tidak perlu akun kedua.</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <a href="/auth?next=%2Fruang-simpan%2F" className="block rounded-xl bg-primary px-5 py-3 text-center font-bold text-primary-foreground">Masuk dengan akun PUB</a>
    <a href="/dashboard" className="block text-center text-primary">Kembali ke PUB ASPEKINDO</a>
  </section></main>;
}
function protectedPage(Page: ComponentType) {
  return function Protected() {
    const { session, loading, error } = usePubAuth();
    if (loading) return <p role="status" className="p-10">Menghubungkan sesi PUB…</p>;
    if (!session || error) return <PubLogin />;
    return <AppShell><ErrorBoundary><Page /></ErrorBoundary></AppShell>;
  };
}
const Portal = protectedPage(PortalPage), Profile = protectedPage(ProfilePage);
const Assistants = protectedPage(AssistantsPage), Activity = protectedPage(ActivityPage);
function Home() {
  const { session, loading } = usePubAuth();
  if (loading) return <p role="status" className="p-10">Menghubungkan sesi PUB…</p>;
  return session ? <Redirect to="/user-portal" /> : <PubLogin />;
}
export default function App() {
  return <QueryClientProvider client={queryClient}><PubAuthProvider><TooltipProvider>
    <Router base={import.meta.env.BASE_URL.replace(/\/$/, "")}><Switch>
      <Route path="/" component={Home} /><Route path="/sign-in/*?" component={PubLogin} /><Route path="/sign-up/*?" component={PubLogin} />
      <Route path="/user-portal" component={Portal} /><Route path="/profile" component={Profile} />
      <Route path="/assistants" component={Assistants} /><Route path="/activity" component={Activity} /><Route component={NotFound} />
    </Switch></Router><Toaster />
  </TooltipProvider></PubAuthProvider></QueryClientProvider>;
}

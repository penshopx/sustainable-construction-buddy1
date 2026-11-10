import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Download, Smartphone, Share, MoreVertical, Plus, Check } from "lucide-react";
import logoPub from "@/assets/logo-pub.png";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center space-y-8"
      >
        <motion.img
          src={logoPub}
          alt="PUB ASPEKINDO"
          className="w-32 h-32 mx-auto object-contain"
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5 }}
        />

        <div>
          <h1 className="text-3xl font-extrabold font-heading text-foreground">
            Install PUB ASPEKINDO
          </h1>
          <p className="text-muted-foreground font-body mt-2">
            Akses cepat langsung dari layar utama perangkat Anda
          </p>
        </div>

        {isInstalled ? (
          <div className="bg-pub-emerald/10 border border-pub-emerald/30 rounded-2xl p-6 space-y-3">
            <Check className="w-12 h-12 text-pub-emerald mx-auto" />
            <p className="text-lg font-bold font-heading text-pub-emerald">Sudah Terinstall!</p>
            <p className="text-sm text-muted-foreground font-body">
              Aplikasi sudah ada di layar utama perangkat Anda.
            </p>
          </div>
        ) : deferredPrompt ? (
          <button
            onClick={handleInstall}
            className="w-full bg-gradient-amber text-accent-foreground font-bold font-heading py-4 px-6 rounded-xl shadow-amber hover:brightness-110 transition-all flex items-center justify-center gap-3 text-lg"
          >
            <Download className="w-6 h-6" />
            Install Sekarang
          </button>
        ) : isIOS ? (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4 text-left">
            <p className="text-sm font-bold font-heading text-foreground text-center">
              Cara Install di iPhone / iPad:
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-pub-sky/10 flex items-center justify-center shrink-0">
                  <Share className="w-4 h-4 text-pub-sky" />
                </div>
                <p className="text-sm text-muted-foreground font-body">
                  Tap ikon <strong className="text-foreground">Share</strong> di Safari (kotak dengan panah ke atas)
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-pub-amber/10 flex items-center justify-center shrink-0">
                  <Plus className="w-4 h-4 text-pub-amber" />
                </div>
                <p className="text-sm text-muted-foreground font-body">
                  Pilih <strong className="text-foreground">"Add to Home Screen"</strong>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-pub-emerald/10 flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4 text-pub-emerald" />
                </div>
                <p className="text-sm text-muted-foreground font-body">
                  Tap <strong className="text-foreground">"Add"</strong> untuk menginstall
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4 text-left">
            <p className="text-sm font-bold font-heading text-foreground text-center">
              Cara Install di Android:
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-pub-sky/10 flex items-center justify-center shrink-0">
                  <MoreVertical className="w-4 h-4 text-pub-sky" />
                </div>
                <p className="text-sm text-muted-foreground font-body">
                  Tap menu <strong className="text-foreground">⋮</strong> di browser Chrome
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-pub-amber/10 flex items-center justify-center shrink-0">
                  <Smartphone className="w-4 h-4 text-pub-amber" />
                </div>
                <p className="text-sm text-muted-foreground font-body">
                  Pilih <strong className="text-foreground">"Install app"</strong> atau <strong className="text-foreground">"Add to Home screen"</strong>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-pub-emerald/10 flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4 text-pub-emerald" />
                </div>
                <p className="text-sm text-muted-foreground font-body">
                  Konfirmasi untuk menginstall
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: "Offline", desc: "Akses tanpa internet" },
            { label: "Cepat", desc: "Loading instan" },
            { label: "Notifikasi", desc: "Update real-time" },
          ].map((f) => (
            <div key={f.label} className="bg-card border border-border rounded-xl p-3">
              <p className="text-sm font-bold font-heading text-foreground">{f.label}</p>
              <p className="text-xs text-muted-foreground font-body">{f.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Install;

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import logoPub from "@/assets/logo-pub-new.png";
import logoAspekindo from "@/assets/logo-aspekindo.png";
import logoLsbuki from "@/assets/logo-lsbuki.png";
import logoLpjk from "@/assets/logo-lpjk.png";

const levelColor: Record<string, string> = {
  Pemula: "#10B981",
  Muda: "#3B82F6",
  Madya: "#8B5CF6",
  Utama: "#F59E0B",
};

export default function CertificatePreview() {
  const { profile } = useAuth();
  const level = profile?.current_level || "Pemula";
  const color = levelColor[level] || "#3B82F6";

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-heading flex items-center gap-2">
          <Eye className="w-5 h-5 text-accent" />
          Preview Sertifikat
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="relative w-full aspect-[1200/850] rounded-lg overflow-hidden shadow-lg"
          style={{ border: `3px solid ${color}` }}
        >
          {/* Inner border */}
          <div className="absolute inset-2 border rounded-md" style={{ borderColor: `${color}40` }} />

          <div className="absolute inset-0 bg-white flex flex-col items-center p-4 text-center">
            {/* Logos row - fixed position */}
            <div className="absolute top-3 left-0 right-0 flex items-center justify-between px-6">
              <div className="flex items-center gap-2">
                <img src={logoPub} alt="PUB" className="h-6 md:h-10 object-contain" />
                <img src={logoAspekindo} alt="ASPEKINDO" className="h-6 md:h-10 object-contain" />
                <img src={logoLsbuki} alt="LSBUKI" className="h-6 md:h-10 object-contain" />
              </div>
              <div className="flex items-center gap-2">
                <img src={logoLpjk} alt="LPJK-PU" className="h-6 md:h-10 object-contain" />
              </div>
            </div>

            {/* Title - pushed down from logos */}
            <h2 className="text-xs md:text-base font-bold tracking-wide mt-14 mb-0" style={{ color }}>
              SERTIFIKAT PELATIHAN PERSONIL MANAJERIAL
            </h2>
            <h2 className="text-sm md:text-lg font-bold mb-0" style={{ color }}>
              BUJK — {profile?.company || "Nama Perusahaan"}
            </h2>
            <p className="text-[9px] md:text-xs text-gray-500 mb-0.5">
              Level: {level}
            </p>

            {/* Legal basis - compact */}
            <div className="px-6 max-w-[92%] mb-0.5">
              <div className="rounded border px-2 py-1" style={{ borderColor: `${color}30`, backgroundColor: `${color}08` }}>
                <p className="text-[5px] md:text-[7px] text-gray-600 leading-snug italic">
                  Berdasarkan UU No. 02/2017 tentang Jasa Konstruksi, Permen PU No. 7/2024 tentang PUB serta Permen PU No. 6/2025, kegiatan PUB ASPEKINDO merupakan salah satu Persyaratan Perpanjangan SBU Jasa Konstruksi. Atas partisipasi dalam kegiatan PUB ASPEKINDO, diberikan :
                </p>
              </div>
            </div>

            {/* Awarded to */}
            <p className="text-[9px] md:text-xs text-gray-400 mb-0.5">Diberikan kepada:</p>
            <h3 className="text-sm md:text-lg font-bold text-gray-900 mb-0.5">
              {profile?.full_name || "Nama Anda"}
            </h3>
            {profile?.position && (
              <p className="text-[10px] md:text-sm text-gray-500 mb-1">
                {profile.position}
              </p>
            )}

            <p className="text-[9px] md:text-xs text-gray-500">
              Telah menyelesaikan modul Pembelajaran sebagai Personil Manajerial BUJK :
            </p>
            <h4 className="text-[10px] md:text-sm font-bold text-gray-900 mt-0.5">
              Nama Modul
            </h4>

            {/* Decorative line */}
            <div className="w-1/3 h-px my-1.5" style={{ backgroundColor: color }} />

            <p className="text-[8px] md:text-[10px] text-gray-400">No. PUB-XXXXX-XXXXX</p>

            {/* Signatures */}
            <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-16 md:gap-24">
              <div className="flex flex-col items-center">
                <p className="text-[7px] md:text-[9px] text-gray-900 font-bold mb-0.5">Eduard Berman Hutagalung, ST</p>
                <div className="w-16 md:w-20 h-px bg-gray-300 mb-0.5" />
                <p className="text-[6px] md:text-[8px] text-gray-500">Ketua PUB ASPEKINDO</p>
              </div>
              <div className="flex flex-col items-center">
                <p className="text-[7px] md:text-[9px] text-gray-900 font-bold mb-0.5">Tumpal SP Sianipar, SE</p>
                <div className="w-16 md:w-20 h-px bg-gray-300 mb-0.5" />
                <p className="text-[6px] md:text-[8px] text-gray-500">Ketua Umum DPN ASPEKINDO</p>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Preview berdasarkan profil Anda saat ini. Hasil download dalam resolusi tinggi (1200×850 px).
        </p>
      </CardContent>
    </Card>
  );
}

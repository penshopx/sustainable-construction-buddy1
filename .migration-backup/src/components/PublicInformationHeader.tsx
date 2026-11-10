import { ArrowLeft, LogIn } from "lucide-react";
import { Link } from "react-router-dom";
import logoPub from "@/assets/logo-pub-new.png";

export default function PublicInformationHeader({ backToHome = false }: { backToHome?: boolean }) {
  return (
    <header className="border-b border-white/10 bg-[hsl(220,60%,8%)] text-white">
      <div className="container mx-auto flex min-h-20 items-center justify-between gap-4 px-6">
        <Link to="/" className="flex items-center gap-3 font-heading font-bold">
          <img src={logoPub} alt="PUB ASPEKINDO" className="h-12 w-12 object-contain" />
          <span>
            <span className="block text-sm tracking-[0.16em] text-pub-sky">PUB ASPEKINDO</span>
            <span className="block text-xs font-normal text-white/60">Pusat Informasi Konstruksi</span>
          </span>
        </Link>
        <nav className="flex items-center gap-2" aria-label="Navigasi publik">
          {backToHome && (
            <Link to="/informasi" className="hidden min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-white/75 hover:bg-white/10 hover:text-white sm:flex">
              <ArrowLeft className="h-4 w-4" /> Pusat Informasi
            </Link>
          )}
          <Link to="/program-kegiatan" className="hidden min-h-11 items-center px-3 text-sm text-white/75 hover:text-white lg:flex">
            Program & Kegiatan
          </Link>
          <Link to="/agenda-pub" className="hidden min-h-11 items-center px-3 text-sm text-white/75 hover:text-white sm:flex">
            Agenda PUB
          </Link>
          <Link to="/" className="hidden min-h-11 items-center px-3 text-sm text-white/75 hover:text-white md:flex">
            Beranda
          </Link>
          <Link to="/auth" className="flex min-h-11 items-center gap-2 rounded-lg bg-pub-sky px-4 text-sm font-semibold text-pub-navy hover:brightness-110">
            <LogIn className="h-4 w-4" /> Masuk / Daftar
          </Link>
        </nav>
      </div>
    </header>
  );
}
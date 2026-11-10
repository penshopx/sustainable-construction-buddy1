import { Building2 } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-primary text-primary-foreground py-12">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-pub-amber/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-pub-amber-light" />
            </div>
            <div>
              <p className="font-bold font-heading text-lg">PUB Konstruksi</p>
              <p className="text-sm text-primary-foreground/60 font-body">ASPEKINDO</p>
            </div>
          </div>
          <p className="text-sm text-primary-foreground/50 font-body">
            © 2026 PUB ASPEKINDO · Berlandaskan Permen PUPR 7/2024 · Menyikapi KepDirjen BK 281/2026
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

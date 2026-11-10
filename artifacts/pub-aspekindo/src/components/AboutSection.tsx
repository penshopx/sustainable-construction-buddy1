import { motion } from "framer-motion";
import logoPub from "@/assets/logo-pub-new.png";
import logoAspekindo from "@/assets/logo-aspekindo.jpg";
import logoLsbuki from "@/assets/logo-lsbuki.webp";

const AboutSection = () => {
  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <span className="text-sm font-semibold text-pub-amber uppercase tracking-wider font-heading">
            Tentang Kami
          </span>
          <h2 className="text-3xl md:text-4xl font-bold font-heading text-foreground mt-2">
            ASPEKINDO & PUB Konstruksi
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-5 font-body text-muted-foreground leading-relaxed"
          >
            <p>
              <strong className="text-foreground">ASPEKINDO</strong> (Akselerasi Seluruh Pemborongan Konstruksi Indonesia) adalah Asosiasi Badan Usaha Jasa Konstruksi Terintegrasi yang menaungi dan memperjuangkan kepentingan BUJK di seluruh Indonesia.
            </p>
            <p>
              <strong className="text-foreground">PUB ASPEKINDO</strong> merupakan program
              Pengembangan Usaha Berkelanjutan yang diselenggarakan untuk membantu anggota
              mempertahankan dan meningkatkan kemampuan usahanya sebagaimana diatur dalam
              Permen PUPR No. 7 Tahun 2024. Platform digital ini mengintegrasikan asesmen,
              pembelajaran, perangkat kerja, dan analitik dalam satu ekosistem.
            </p>
            <p>
              <strong className="text-foreground">LSBU KI</strong> (Lembaga Sertifikasi Badan
              Usaha Konstruksi Indonesia) bentukan ASPEKINDO memberikan layanan sertifikasi
              badan usaha jasa konstruksi. Standar skema sertifikasinya mengacu pada ketentuan
              terbaru, termasuk KepDirjen Bina Konstruksi No. 281/KPTS/DK/2026 sebagai
              pengganti KepDirjen No. 37KPTS/DK/2025.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <div className="flex justify-center gap-8">
              {[
                { src: logoPub, alt: "Logo PUB", label: "PUB" },
                { src: logoAspekindo, alt: "Logo ASPEKINDO", label: "ASPEKINDO" },
                { src: logoLsbuki, alt: "Logo LSBU KI", label: "LSBU KI" },
              ].map((logo) => (
                <div key={logo.label} className="flex flex-col items-center gap-2">
                  <div className="w-24 h-24 rounded-xl bg-card border border-border shadow-card flex items-center justify-center p-3">
                    <img src={logo.src} alt={logo.alt} className="w-full h-full object-contain" />
                  </div>
                  <span className="text-sm font-semibold font-heading text-foreground">{logo.label}</span>
                </div>
              ))}
            </div>

            <blockquote className="mt-8 p-5 rounded-xl bg-pub-amber/5 border border-pub-amber/20 text-sm italic text-muted-foreground font-body">
              "Setiap BUJK harus melakukan PUB untuk meningkatkan kompetensi BUJK."
              <footer className="mt-2 text-xs font-semibold text-foreground not-italic">
                — Permen PUPR No. 7 Tahun 2024, Pasal 3 ayat (1)
              </footer>
            </blockquote>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;

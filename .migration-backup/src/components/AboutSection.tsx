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
              <strong className="text-foreground">PUB ASPEKINDO</strong> merupakan program pelaksanaan Pengembangan Usaha Berkelanjutan — kewajiban setiap BUJK berdasarkan regulasi pemerintah. Platform digital ini mengintegrasikan assessment, learning, toolkit, dan analytics dalam satu ekosistem.
            </p>
            <p>
              <strong className="text-foreground">LSBU KI</strong> (Lembaga Sertifikasi Badan Usaha Konstruksi Indonesia) bentukan ASPEKINDO memberikan layanan sertifikasi badan usaha jasa konstruksi, melengkapi ekosistem PUB untuk memastikan setiap BUJK memenuhi standar kompetensi nasional.
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
              "Setiap Badan Usaha Jasa Konstruksi memiliki kewajiban melaksanakan kegiatan Pengembangan Usaha Berkelanjutan (PUB) untuk meningkatkan kapasitas dan daya saing."
              <footer className="mt-2 text-xs font-semibold text-foreground not-italic">
                — PP 14/2021 tentang Perubahan PP 22/2020
              </footer>
            </blockquote>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;

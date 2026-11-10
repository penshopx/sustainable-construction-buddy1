import { motion } from "framer-motion";
import { Shield, Globe, BookOpen, Award } from "lucide-react";
import logoPub from "@/assets/logo-pub-new.png";
import logoAspekindo from "@/assets/logo-aspekindo.png";
import logoLsbuki from "@/assets/logo-lsbuki.webp";
import logoPu from "@/assets/logo-pu.png";

const credentials = [
  { value: "UU 2/2017", label: "Jasa Konstruksi", sub: "Kerangka hukum penyelenggaraan jasa konstruksi" },
  { value: "PP 14/2021", label: "Pelaksanaan UU", sub: "Perubahan atas PP 22 Tahun 2020" },
  { value: "Permen PUPR 7/2024", label: "Dasar Penyelenggaraan PUB", sub: "Pengembangan Usaha Berkelanjutan" },
  { value: "Permen PU 6/2025", label: "Standar Berusaha Berbasis Risiko", sub: "Acuan kegiatan usaha dan produk/jasa sektor PU" },
  { value: "KepDirjen BK 281/2026", label: "Standar Skema Sertifikasi BUJK", sub: "Mencabut dan menggantikan KepDirjen 37/2025" },
];

const logos = [
  { src: logoPu, alt: "Kementerian Pekerjaan Umum", name: "Kementerian PU" },
  { src: logoPub, alt: "PUB ASPEKINDO", name: "PUB ASPEKINDO" },
  { src: logoAspekindo, alt: "ASPEKINDO", name: "ASPEKINDO" },
  { src: logoLsbuki, alt: "LSBU KI", name: "LSBU KI" },
];

const values = [
  { icon: Shield, title: "Berbasis Regulasi Resmi", desc: "Program PUB merujuk pada ketentuan Pengembangan Usaha Berkelanjutan dan sertifikasi BUJK yang berlaku." },
  { icon: Globe, title: "Jangkauan Nasional", desc: "Platform digital yang dapat diakses oleh BUJK dari seluruh wilayah Indonesia kapan saja." },
  { icon: BookOpen, title: "Pembelajaran Berkelanjutan", desc: "Modul dan program belajar dirancang untuk mendukung pengembangan kompetensi jangka panjang." },
  { icon: Award, title: "Sertifikasi Terverifikasi", desc: "Setiap pencapaian kompetensi didokumentasikan sebagai bukti nyata pengembangan BUJK." },
];

const SocialProofSection = () => {
  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-6">
        {/* Institutional logos */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider font-heading mb-6">
            Dalam Ekosistem Jasa Konstruksi
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
            {logos.map((logo) => (
              <div key={logo.name} className="flex flex-col items-center gap-2">
                <div className="w-20 h-20 rounded-xl bg-card border border-border shadow-card flex items-center justify-center p-3">
                  <img src={logo.src} alt={logo.alt} className="w-full h-full object-contain" />
                </div>
                <span className="text-xs font-semibold font-heading text-muted-foreground">{logo.name}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Legal basis */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="mb-8 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-pub-amber font-heading">
              Landasan Regulasi PUB dan Sertifikasi BUJK
            </p>
            <h3 className="mt-2 text-2xl font-bold text-foreground font-heading md:text-3xl">
              Dasar yang jelas untuk BUJK yang lebih siap
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {credentials.map((c) => (
              <div key={c.value} className="p-4 rounded-xl bg-pub-amber/5 border border-pub-amber/15 text-center">
                <p className="text-base font-extrabold font-heading text-pub-amber">{c.value}</p>
                <p className="text-sm font-semibold text-foreground mt-1 font-heading">{c.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground font-body">{c.sub}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-xl border border-pub-sky/20 bg-pub-sky/5 px-5 py-4 text-sm leading-relaxed text-muted-foreground font-body">
            <strong className="text-foreground">Status ketentuan terbaru:</strong> KepDirjen Bina
            Konstruksi No. 281/KPTS/DK/2026 ditetapkan pada 26 Agustus 2026 dan mencabut
            KepDirjen No. 37KPTS/DK/2025. Implementasi skema sertifikasi berdasarkan
            pengaturan baru mengikuti kesiapan SIJK terintegrasi dan surat pemberlakuan resmi
            dari unit organisasi yang membidangi jasa konstruksi.
          </div>
        </motion.div>

        {/* Platform values — qualitative, no numbers */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h3 className="text-2xl md:text-3xl font-bold font-heading text-foreground">
            Ekosistem yang Dibangun untuk BUJK Indonesia
          </h3>
          <p className="text-muted-foreground mt-2 max-w-xl mx-auto font-body">
            Lebih dari sekadar aplikasi — PUB ASPEKINDO adalah ekosistem pertumbuhan bersama.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-14">
          {values.map((v, i) => (
            <motion.div
              key={v.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="p-5 rounded-xl bg-muted/50 border border-border text-center"
            >
              <div className="w-12 h-12 rounded-xl bg-pub-amber/10 flex items-center justify-center mx-auto mb-3">
                <v.icon className="w-6 h-6 text-pub-amber" />
              </div>
              <h4 className="text-sm font-bold font-heading text-foreground mb-2">{v.title}</h4>
              <p className="text-xs text-muted-foreground font-body leading-relaxed">{v.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Quote */}
        <motion.blockquote
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-4 p-6 rounded-xl bg-pub-amber/5 border border-pub-amber/20 text-center max-w-3xl mx-auto"
        >
          <p className="text-base italic text-muted-foreground font-body leading-relaxed">
            "PUB adalah upaya terus-menerus untuk mempertahankan dan/atau meningkatkan kemampuan BUJK agar mampu melaksanakan pekerjaan sesuai dengan sertifikat badan usaha yang dimilikinya."
          </p>
          <footer className="mt-3 text-sm font-semibold text-foreground not-italic font-heading">
            — Permen PUPR No. 7 Tahun 2024, Pasal 1 angka 3
          </footer>
        </motion.blockquote>
      </div>
    </section>
  );
};

export default SocialProofSection;

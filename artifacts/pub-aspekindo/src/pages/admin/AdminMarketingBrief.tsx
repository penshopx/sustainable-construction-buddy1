import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check, FileText, Target, Megaphone, Sparkles } from "lucide-react";
import { toast } from "@/components/ui/sonner-toast";

const sections = {
  elevator: {
    title: "Elevator Pitch",
    icon: Sparkles,
    content: `PUB ASPEKINDO adalah platform digital terintegrasi pertama di Indonesia yang membantu Badan Usaha Jasa Konstruksi (BUJK) meningkatkan kompetensi, memenuhi regulasi, dan memperkuat daya saing — semuanya dalam satu ekosistem.

Dengan 202.000+ BUJK yang wajib memiliki SBU dan tingkat kegagalan perpanjangan mencapai 35%, PUB ASPEKINDO hadir sebagai solusi end-to-end: dari e-learning adaptif, asesmen PANCEK/SMAP, hingga marketplace material dan AI mentor — didukung teknologi cloud-native dan kecerdasan buatan.`,
  },
  problem: {
    title: "Masalah yang Diselesaikan",
    icon: Target,
    content: `1. **35% BUJK gagal perpanjangan SBU** karena tidak memenuhi persyaratan PANCEK, SMAP, dan LKUT
2. **Minimnya akses pelatihan terstruktur** untuk tenaga konstruksi di daerah
3. **Data operasional tersebar** di spreadsheet tanpa integrasi dan analisis
4. **Tidak ada platform terpadu** yang menghubungkan compliance, kompetensi, dan bisnis konstruksi
5. **Biaya konsultasi tinggi** untuk memenuhi regulasi terbaru sektor jasa konstruksi`,
  },
  regulasi: {
    title: "Dasar Hukum",
    icon: FileText,
    content: `**📜 Undang-Undang**
- UU No. 2 Tahun 2017 tentang Jasa Konstruksi

**📋 Peraturan Pemerintah**
- PP No. 5 Tahun 2021 tentang Penyelenggaraan Perizinan Berusaha Berbasis Risiko
- PP No. 14 Tahun 2021 tentang Perubahan Atas PP No. 22 Tahun 2020 tentang Peraturan Pelaksanaan UU No. 2 Tahun 2017 tentang Jasa Konstruksi
- PP No. 28 Tahun 2025 tentang Penyelenggaraan Perizinan Berusaha Berbasis Risiko

**📑 Peraturan Menteri**
- Permen PU No. 8 Tahun 2022 tentang Tata Cara Pelaksanaan Pemenuhan Sertifikat Standar Jasa Konstruksi dalam Rangka Mendukung Kemudahan Perizinan Berusaha bagi Pelaku Usaha Jasa Konstruksi
- Permen PUPR No. 7 Tahun 2024 tentang Pengembangan Usaha Berkelanjutan
- Permen PU No. 6 Tahun 2025 tentang Standar Kegiatan Usaha dan/atau Standar Produk/Jasa, Pelaksanaan, Pengawasan, dan Pengenaan Sanksi pada Penyelenggaraan Perizinan Berusaha Berbasis Risiko Sektor Pekerjaan Umum

**📌 Surat Edaran & SK**
- SE No. 05/SE/LPJK/2025 tentang Pedoman Pelaporan Penyelenggaraan Pengembangan Usaha Berkelanjutan
- SK Dirjen Bina Konstruksi No. 37 Tahun 2025 tentang Skema Kompetensi Sertifikat Badan Usaha Jasa Konstruksi`,
  },
  features: {
    title: "Keunggulan Fitur",
    icon: FileText,
    content: `**🎓 Kompetensi & Pembelajaran**
- Pre-test Assessment adaptif dengan 4 level
- E-Course terstruktur per domain kompetensi
- AI Mentor Digital berbasis knowledge base
- Sertifikat digital otomatis

**📊 Data Operasional & Compliance**
- LKUT (Laporan Kinerja Usaha Tahunan)
- PANCEK (Penilaian Kinerja BUJK) sesuai Permen PUPR
- SMAP (Sistem Manajemen Anti Penyuapan)
- K3 Checklist & Risk Register
- Performance Grade otomatis

**💼 Komunitas & Bisnis**
- Marketplace material & jasa konstruksi
- Direktori BUJK terintegrasi
- Inovasi PUB — wadah ide & solusi
- Program & Kegiatan asosiasi

**🤖 Teknologi**
- AI-Powered (Gemini & GPT)
- Cloud-native PWA
- Real-time dashboard & analytics
- 40+ mini-apps toolkit inovatif`,
  },
  market: {
    title: "Target Pasar & Potensi",
    icon: Megaphone,
    content: `**TAM (Total Addressable Market)**
- 202.000+ BUJK aktif di Indonesia
- Wajib SBU berdasarkan UU No. 2/2017 tentang Jasa Konstruksi

**SAM (Serviceable Available Market)**
- 50.000+ BUJK kualifikasi Kecil & Menengah
- Prioritas anggota ASPEKINDO

**SOM (Serviceable Obtainable Market)**
- Target 5.000 BUJK di tahun pertama
- Revenue model: SaaS subscription (Starter Rp 99rb/bln, Pro Rp 299rb/bln, Enterprise custom)

**Competitive Advantage**
- Satu-satunya platform yang mengintegrasikan compliance + kompetensi + marketplace
- Didukung langsung oleh PUB ASPEKINDO sebagai organisasi asosiasi resmi
- AI-powered assessment & mentoring
- Tim praktisi senior konstruksi (25+ tahun pengalaman)`,
  },
};

export default function AdminMarketingBrief() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text.replace(/\*\*/g, "").replace(/\n/g, "\n"));
    setCopiedSection(key);
    toast.success("Disalin ke clipboard!");
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleCopyAll = () => {
    const allText = Object.values(sections)
      .map((s) => `## ${s.title}\n\n${s.content}`)
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(allText.replace(/\*\*/g, ""));
    toast.success("Semua konten disalin ke clipboard!");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground">Brief Marketing</h1>
            <p className="text-sm text-muted-foreground">Materi pemasaran siap pakai untuk PUB ASPEKINDO</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleCopyAll}>
          <Copy className="w-4 h-4 mr-2" />
          Salin Semua
        </Button>
      </div>

      <Tabs defaultValue="elevator">
        <TabsList className="flex-wrap h-auto gap-1">
          {Object.entries(sections).map(([key, s]) => (
            <TabsTrigger key={key} value={key} className="gap-1.5">
              <s.icon className="w-3.5 h-3.5" />
              {s.title}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(sections).map(([key, s]) => (
          <TabsContent key={key} value={key}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <s.icon className="w-4 h-4 text-primary" />
                  {s.title}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(key, s.content)}
                >
                  {copiedSection === key ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-line">
                  {s.content.split("\n").map((line, i) => {
                    // Bold handling
                    const parts = line.split(/\*\*(.*?)\*\*/g);
                    return (
                      <p key={i} className="my-1">
                        {parts.map((part, j) =>
                          j % 2 === 1 ? (
                            <strong key={j}>{part}</strong>
                          ) : (
                            <span key={j}>{part}</span>
                          )
                        )}
                      </p>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <Card className="border-dashed">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="mt-0.5 shrink-0">Tips</Badge>
            <p className="text-sm text-muted-foreground">
              Gunakan materi ini untuk presentasi investor, proposal kerjasama, atau posting media sosial. 
              Klik tombol salin pada setiap bagian untuk mendapatkan teks siap tempel.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

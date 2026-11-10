import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export type ReadinessKind = "sbu" | "lkut";
type ReadinessStatus = "ready" | "partial" | "not_ready";

interface ReadinessItem {
  id: string;
  category: string;
  title: string;
  description: string;
}

interface SimulatorConfig {
  eyebrow: string;
  title: string;
  description: string;
  note: string;
  items: ReadinessItem[];
}

// Configuration is exported for the standalone simulator pages.
// eslint-disable-next-line react-refresh/only-export-components
export const SIMULATOR_CONFIGS: Record<ReadinessKind, SimulatorConfig> = {
  sbu: {
    eyebrow: "Simulator Kesiapan SBU",
    title: "Ukur kesiapan BUJK sebelum mengurus SBU",
    description:
      "Petakan kesiapan legalitas, tenaga kerja, pengalaman, peralatan, keuangan, dan bukti kepatuhan sebelum masuk proses pengurusan atau perpanjangan SBU.",
    note:
      "Hasil ini adalah asesmen awal untuk membantu BUJK menyusun prioritas dokumen. Ini bukan keputusan atau verifikasi resmi LPJK.",
    items: [
      {
        id: "sbu-legalitas",
        category: "Legalitas & administrasi",
        title: "Akta, NIB, OSS, dan KBLI sesuai",
        description: "Dokumen badan usaha dan bidang usaha sudah tersedia, konsisten, serta sesuai layanan konstruksi yang dituju.",
      },
      {
        id: "sbu-tax",
        category: "Legalitas & administrasi",
        title: "NPWP dan administrasi perpajakan tertata",
        description: "Identitas perpajakan dan dokumen pelaporan yang diperlukan dapat ditemukan saat diminta.",
      },
      {
        id: "sbu-kta",
        category: "Legalitas & administrasi",
        title: "KTA asosiasi masih berlaku",
        description: "Keanggotaan asosiasi dan bukti KTA tersedia untuk periode pengurusan yang direncanakan.",
      },
      {
        id: "sbu-skk",
        category: "SDM & kompetensi",
        title: "SKK personil penanggung jawab tersedia",
        description: "Data PJBU, PJT, atau PJSKBU dan kesesuaian SKK-nya sudah diperiksa.",
      },
      {
        id: "sbu-experience",
        category: "Pengalaman & operasional",
        title: "Pengalaman pekerjaan terdokumentasi",
        description: "Kontrak, berita acara, nilai pekerjaan, dan detail proyek siap dicatat pada sistem pengalaman yang relevan.",
      },
      {
        id: "sbu-equipment",
        category: "Pengalaman & operasional",
        title: "Data peralatan konstruksi dapat dibuktikan",
        description: "Daftar alat, kepemilikan atau penguasaan, serta bukti pendukung siap dicatat dan ditelusuri.",
      },
      {
        id: "sbu-finance",
        category: "Keuangan & kepatuhan",
        title: "Neraca dan laporan keuangan tersedia",
        description: "Laporan keuangan periode yang diperlukan sudah disusun dan memiliki dokumen pendukung.",
      },
      {
        id: "sbu-smap",
        category: "Keuangan & kepatuhan",
        title: "SMAP dan PANCEK memiliki bukti penerapan",
        description: "Kebijakan, kegiatan, penilaian, atau bukti penerapan anti penyuapan dapat ditunjukkan.",
      },
      {
        id: "sbu-pub",
        category: "Keuangan & kepatuhan",
        title: "Bukti pelaksanaan kegiatan PUB tersedia",
        description: "Riwayat pelatihan, kegiatan, evaluasi, atau sertifikat PUB dapat direkap untuk mendukung penyiapan data.",
      },
      {
        id: "sbu-review",
        category: "Keuangan & kepatuhan",
        title: "Ada penanggung jawab dan jadwal pengurusan",
        description: "BUJK sudah menetapkan PIC, target waktu, serta pemeriksaan akhir sebelum dokumen dipakai.",
      },
    ],
  },
  lkut: {
    eyebrow: "Simulator Kesiapan LKUT",
    title: "Ukur kesiapan dokumen LKUT BUJK",
    description:
      "Periksa apakah data kegiatan usaha, proyek, kepatuhan, keuangan, dan kegiatan PUB sudah siap direkap sebelum batas akhir penyerahan LKUT.",
    note:
      "Simulator ini membantu menyiapkan data di aplikasi PUB. Penyerahan akhir tetap mengikuti aplikasi dan ketentuan resmi Kementerian PU/LPJK.",
    items: [
      {
        id: "lkut-profile",
        category: "Identitas & perizinan",
        title: "Profil BUJK, NIB, SBU, dan KTA lengkap",
        description: "Identitas perusahaan, status SBU, dan keanggotaan asosiasi memiliki dokumen pendukung yang terbaru.",
      },
      {
        id: "lkut-finance",
        category: "Keuangan & perpajakan",
        title: "Neraca dan laporan keuangan periode berjalan siap",
        description: "Angka utama, periode laporan, serta dokumen pendukung sudah dikumpulkan untuk direkap.",
      },
      {
        id: "lkut-tax",
        category: "Keuangan & perpajakan",
        title: "Data perpajakan dapat ditelusuri",
        description: "Dokumen atau catatan perpajakan yang diminta dapat ditemukan dan dikaitkan dengan periode laporan.",
      },
      {
        id: "lkut-projects",
        category: "Kegiatan & proyek",
        title: "Detail proyek tahun laporan sudah dicatat",
        description: "Nama pekerjaan, pemberi kerja, nilai, waktu, status, dan bukti proyek tersedia untuk penyiapan LKUT.",
      },
      {
        id: "lkut-experience",
        category: "Kegiatan & proyek",
        title: "Pengalaman usaha sudah direkonsiliasi",
        description: "Data pengalaman pada catatan internal dan sistem pengalaman yang relevan sudah diperiksa agar konsisten.",
      },
      {
        id: "lkut-skk",
        category: "SDM & peralatan",
        title: "Data personil dan SKK diperbarui",
        description: "Personil terkait, jabatan, status SKK, dan perubahan tenaga kerja sudah memiliki catatan pendukung.",
      },
      {
        id: "lkut-equipment",
        category: "SDM & peralatan",
        title: "Data peralatan konstruksi diperbarui",
        description: "Daftar peralatan, status penguasaan, dan perubahan selama periode laporan telah diperiksa.",
      },
      {
        id: "lkut-compliance",
        category: "Kepatuhan",
        title: "SMAP, PANCEK, dan K3 memiliki catatan",
        description: "Catatan penerapan, pemeriksaan, dan tindak lanjut kepatuhan tersimpan untuk periode laporan.",
      },
      {
        id: "lkut-pub",
        category: "Kepatuhan",
        title: "Kegiatan PUB dan bukti keikutsertaan sudah terekam",
        description: "LMS, agenda, presensi, evaluasi, atau sertifikat kegiatan PUB dapat direkap sebagai bukti kegiatan.",
      },
      {
        id: "lkut-export",
        category: "Kepatuhan",
        title: "Pemeriksaan akhir dan paket ekspor sudah siap",
        description: "Data tidak ganda, periode benar, dokumen terhubung, dan rekap siap ditinjau sebelum dipindahkan ke aplikasi LKUT resmi.",
      },
    ],
  },
};

const STATUS_META: Record<ReadinessStatus, { label: string; shortLabel: string; icon: typeof CheckCircle2; className: string }> = {
  ready: {
    label: "Siap",
    shortLabel: "Siap",
    icon: CheckCircle2,
    className: "border-pub-emerald/40 bg-pub-emerald/10 text-pub-emerald",
  },
  partial: {
    label: "Perlu dilengkapi",
    shortLabel: "Lengkapi",
    icon: AlertTriangle,
    className: "border-pub-amber/40 bg-pub-amber/10 text-pub-amber",
  },
  not_ready: {
    label: "Belum siap",
    shortLabel: "Belum",
    icon: XCircle,
    className: "border-destructive/30 bg-destructive/5 text-destructive",
  },
};

const STATUS_POINTS: Record<ReadinessStatus, number> = {
  ready: 1,
  partial: 0.5,
  not_ready: 0,
};

export default function ReadinessSimulator({ kind }: { kind: ReadinessKind }) {
  const config = SIMULATOR_CONFIGS[kind];
  const [statuses, setStatuses] = useState<Record<string, ReadinessStatus>>({});
  const [hasResult, setHasResult] = useState(false);

  const categories = useMemo(
    () => [...new Set(config.items.map((item) => item.category))],
    [config.items],
  );

  const score = useMemo(() => {
    const total = config.items.reduce(
      (sum, item) => sum + STATUS_POINTS[statuses[item.id] ?? "not_ready"],
      0,
    );
    return Math.round((total / config.items.length) * 100);
  }, [config.items, statuses]);

  const completedCount = config.items.filter((item) => statuses[item.id]).length;
  const needsAttention = config.items.filter((item) => (statuses[item.id] ?? "not_ready") !== "ready");

  const setStatus = (id: string, status: ReadinessStatus) => {
    setStatuses((current) => ({ ...current, [id]: status }));
    setHasResult(false);
  };

  const reset = () => {
    setStatuses({});
    setHasResult(false);
  };

  const scoreLabel = score >= 80 ? "Siap ditindaklanjuti" : score >= 60 ? "Perlu melengkapi beberapa hal" : "Perlu persiapan lebih lanjut";
  const scoreClass = score >= 80 ? "text-pub-emerald" : score >= 60 ? "text-pub-amber" : "text-destructive";

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-pub-sky/20 bg-gradient-to-br from-pub-navy/[0.06] via-card to-pub-sky/[0.06]">
        <CardHeader className="border-b border-border/70">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pub-sky/10 text-pub-sky">
              {kind === "sbu" ? <ShieldCheck className="h-5 w-5" /> : <FileCheck2 className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pub-sky">{config.eyebrow}</p>
              <CardTitle className="mt-1 text-xl font-heading md:text-2xl">{config.title}</CardTitle>
              <CardDescription className="mt-2 max-w-3xl leading-relaxed">{config.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-5 md:p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-background/70 p-4">
              <p className="text-xs text-muted-foreground">Skor kesiapan</p>
              <p className={`mt-1 text-3xl font-extrabold font-heading ${scoreClass}`}>{score}%</p>
            </div>
            <div className="rounded-xl border border-border bg-background/70 p-4">
              <p className="text-xs text-muted-foreground">Status diisi</p>
              <p className="mt-1 text-3xl font-extrabold font-heading text-foreground">{completedCount}/{config.items.length}</p>
            </div>
            <div className="rounded-xl border border-border bg-background/70 p-4">
              <p className="text-xs text-muted-foreground">Prioritas tindak lanjut</p>
              <p className="mt-1 text-3xl font-extrabold font-heading text-foreground">{needsAttention.length}</p>
            </div>
          </div>
          <Progress value={score} className="h-2.5" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Tandai kondisi setiap butir sesuai keadaan BUJK saat ini. Nilai akan berubah setelah status dipilih.
          </p>
        </CardContent>
      </Card>

      {categories.map((category) => (
        <Card key={category}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-heading">
              <ClipboardCheck className="h-4 w-4 text-pub-amber" />
              {category}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {config.items.filter((item) => item.category === category).map((item) => {
              const currentStatus = statuses[item.id] ?? "not_ready";
              return (
                <div key={item.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold font-heading text-foreground">{item.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                    </div>
                    <div className="grid shrink-0 grid-cols-3 gap-1.5 lg:w-[270px]">
                      {(Object.keys(STATUS_META) as ReadinessStatus[]).map((status) => {
                        const meta = STATUS_META[status];
                        const Icon = meta.icon;
                        const isSelected = currentStatus === status;
                        return (
                          <Button
                            key={status}
                            type="button"
                            variant="outline"
                            size="sm"
                            aria-pressed={isSelected}
                            onClick={() => setStatus(item.id, status)}
                            className={`h-auto min-h-9 gap-1 px-2 text-[11px] ${isSelected ? meta.className : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"}`}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            <span>{meta.shortLabel}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      <Card className="border-pub-amber/25 bg-pub-amber/[0.06]">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold font-heading text-foreground">Sudah selesai menilai?</p>
            <p className="mt-1 text-sm text-muted-foreground">Tampilkan ringkasan dan urutan prioritas perbaikan BUJK.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={reset} className="gap-2">
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
            <Button type="button" onClick={() => setHasResult(true)} className="gap-2 bg-gradient-amber text-accent-foreground shadow-amber hover:brightness-110">
              <Sparkles className="h-4 w-4" /> Lihat hasil kesiapan
            </Button>
          </div>
        </CardContent>
      </Card>

      {hasResult && (
        <Card className="border-pub-emerald/25">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="font-heading">Ringkasan hasil</CardTitle>
                <CardDescription className="mt-1">Hasil ini menjadi peta kerja awal sebelum dokumen diproses lebih lanjut.</CardDescription>
              </div>
              <Badge className={score >= 80 ? "bg-pub-emerald text-white" : score >= 60 ? "bg-pub-amber text-pub-navy" : "bg-destructive text-white"}>
                {scoreLabel}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-4">
              <div className={`text-4xl font-extrabold font-heading ${scoreClass}`}>{score}%</div>
              <div>
                <p className="font-semibold font-heading text-foreground">{scoreLabel}</p>
                <p className="text-sm text-muted-foreground">{completedCount} dari {config.items.length} butir sudah diberi status.</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-pub-sky/20 bg-pub-sky/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold font-heading text-foreground">Lanjutkan dengan data aktual anggota</p>
                <p className="mt-1 text-sm text-muted-foreground">Bandingkan hasil simulator ini dengan bukti dari LMS, asesmen, LKUT, PANCEK, SMAP, dan workspace proyek.</p>
              </div>
              <Button asChild variant="outline" className="shrink-0 border-pub-sky/30 text-pub-sky">
                <Link to="/siap-kompetensi">
                  Peta Kompetensi 4 SIAP <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            {needsAttention.length > 0 ? (
              <div>
                <p className="mb-2 text-sm font-semibold font-heading text-foreground">Prioritas perbaikan</p>
                <ul className="space-y-2">
                  {needsAttention.map((item) => (
                    <li key={item.id} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-pub-amber" />
                      <span><strong className="text-foreground">{item.title}</strong> — {STATUS_META[statuses[item.id] ?? "not_ready"].label.toLowerCase()}.</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-xl bg-pub-emerald/10 p-4 text-sm text-pub-emerald">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Semua butir ditandai siap. Tetap lakukan pemeriksaan dokumen dan ikuti ketentuan resmi sebelum pengajuan.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        Catatan: {config.note}
      </p>
    </div>
  );
}
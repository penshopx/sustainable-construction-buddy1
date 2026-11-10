import type { calculateProjectEvm } from "@/lib/projectEvm";

type ProjectEvm = ReturnType<typeof calculateProjectEvm>;

export const BRAIN_TOPIC = "brain-project";

export const PERSPECTIVES = [
  { id: "intelligence", name: "Intelligence", desc: "Sintesis fakta proyek menjadi gambaran situasi yang bisa ditindaklanjuti." },
  { id: "risk", name: "Risiko", desc: "Risiko biaya, jadwal, mutu, dan keselamatan beserta tanda peringatannya." },
  { id: "performance", name: "Kinerja", desc: "Membaca CPI dan SPI yang Anda isi, bukan menebak angka yang tidak ada." },
  { id: "decision", name: "Keputusan", desc: "Opsi tindakan dengan kriteria, trade-off, dan bukti yang dibutuhkan." },
  { id: "stakeholder", name: "Pemangku kepentingan", desc: "Pemilik, pengawas, subkontraktor, pemasok: kepentingan dan pesan kunci." },
  { id: "forecast", name: "Proyeksi", desc: "EAC, ETC, dan TCPI dengan asumsi yang dinyatakan terbuka." },
] as const;

export const BRAIN_PERSONA = "Anda analis proyek konstruksi untuk anggota PUB ASPEKINDO. Satu analisis, enam sudut pandang. Gunakan hanya fakta yang diberikan pengguna dan acuan Ruang Simpan bila tersedia; tandai asumsi. Jangan mengarang angka, status sertifikasi, atau kepatuhan. Angka EVM sudah dihitung oleh aplikasi; jangan menghitung ulang dengan angka lain. Jawab dalam Bahasa Indonesia.";

export interface ProjectFacts {
  name: string; owner: string; contractType: string; progress: string; period: string; issues: string; question: string;
}
export const EMPTY_FACTS: ProjectFacts = { name: "", owner: "", contractType: "", progress: "", period: "", issues: "", question: "" };

const fmt = (v: number | null, d = 2) => (v === null ? "tidak tersedia (penyebut nol)" : v.toLocaleString("id-ID", { maximumFractionDigits: d }));

export function buildBrainPrompt(f: ProjectFacts, evm: { input: { bac: number; pv: number; ev: number; ac: number }; out: ProjectEvm } | null): string {
  const line = (k: string, v: string) => (v.trim() ? `- ${k}: ${v.trim()}` : `- ${k}: (tidak diisi)`);
  const evmBlock = evm
    ? `Data EVM (dihitung aplikasi, satuan sesuai input pengguna):
- BAC ${fmt(evm.input.bac)}, PV ${fmt(evm.input.pv)}, EV ${fmt(evm.input.ev)}, AC ${fmt(evm.input.ac)}
- CPI ${fmt(evm.out.cpi, 3)}, SPI ${fmt(evm.out.spi, 3)}, EAC ${fmt(evm.out.eac)}, ETC ${fmt(evm.out.etc)}, VAC ${fmt(evm.out.vac)}, TCPI ${fmt(evm.out.tcpi, 3)}
- Asumsi: EAC = BAC / CPI (kinerja biaya saat ini berlanjut).`
    : "Data EVM: tidak diisi. Jangan membuat angka EVM; sebutkan data yang perlu dikumpulkan.";
  return `ANALISIS BRAIN PROJECT (satu analisis, enam sudut pandang)
Fakta proyek dari pengguna:
${line("Nama/jenis proyek", f.name)}
${line("Pemilik/pemberi kerja", f.owner)}
${line("Jenis kontrak", f.contractType)}
${line("Progres & periode", [f.progress, f.period].filter(Boolean).join("; "))}
${line("Masalah/gejala", f.issues)}
${line("Pertanyaan utama", f.question)}
${evmBlock}

Susun jawaban Markdown dengan judul bagian:
1. Intelligence  2. Risiko  3. Kinerja  4. Keputusan  5. Pemangku kepentingan  6. Proyeksi
Lalu: Tabel tindakan prioritas (Tindakan | Penanggung jawab | Tenggat | Bukti) dan daftar celah data.`;
}

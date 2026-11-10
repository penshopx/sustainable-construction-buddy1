import type { Msg } from "@/hooks/useHelpdeskChat";

export const CONSULT_TOPIC = "project-consultation";
export type StageId = "diagnosis" | "eksplorasi" | "blueprint";

export const STAGES: { id: StageId; label: string; hint: string }[] = [
  { id: "diagnosis", label: "Diagnosis", hint: "Ceritakan situasi saat ini: proyek, kendala, dan bukti yang Anda pegang." },
  { id: "eksplorasi", label: "Eksplorasi", hint: "Jawab pertanyaan lanjutan AI, tambahkan batasan, dan pilih opsi yang ingin didalami." },
  { id: "blueprint", label: "Blueprint", hint: "Minta rencana tindak terstruktur: prioritas, bukti dan celah, penanggung jawab, tenggat." },
];

export interface Profession { id: string; name: string; focus: string; persona: string }

const base = "Anda pendamping konsultasi PUB ASPEKINDO untuk usaha jasa konstruksi Indonesia. Jawab dalam Bahasa Indonesia yang lugas. Jangan mengarang nomor sertifikat, status SBU/SKK, nilai kontrak, atau regulasi yang tidak Anda yakini; tandai asumsi dan sebut data yang masih kurang. Anda bukan lembaga sertifikasi, asesmen, lisensi, atau akreditasi.";

export const PROFESSIONS: Profession[] = [
  { id: "konsultan-perencana", name: "Konsultan Perencana / Pengawas", focus: "Perencanaan, mutu, metode kerja, dan pengawasan", persona: "Fokus pada perencanaan teknis, mutu, dan bukti pengawasan." },
  { id: "kontraktor", name: "Kontraktor / Pelaksana Proyek", focus: "Biaya, jadwal, pelaksanaan, dan koordinasi lapangan", persona: "Fokus pada pengendalian biaya, EVM, jadwal, keselamatan, dan pelaksanaan proyek." },
  { id: "legal", name: "Konsultan Hukum / Legal", focus: "Kontrak, perubahan pekerjaan, dan bukti sengketa", persona: "Fokus pada kontrak dan risiko hukum; bedakan informasi awal dari pendapat hukum profesional." },
  { id: "pengajar", name: "Dosen / Trainer / Pengajar", focus: "Pembelajaran, kompetensi, dan transfer pengetahuan", persona: "Fokus pada kebutuhan pembelajaran, rancangan pelatihan, dan bukti kompetensi." },
  { id: "pengusaha", name: "Pengusaha / Wirausaha", focus: "Strategi usaha, kapasitas, arus kas, dan peluang", persona: "Fokus pada strategi usaha, kapasitas, kesehatan keuangan, dan peluang yang realistis." },
  { id: "asn", name: "ASN / Aparatur Sipil Negara", focus: "Tata kelola, pengadaan, dan akuntabilitas", persona: "Fokus pada tata kelola, pengadaan, dan akuntabilitas; jangan mengarang aturan atau kewenangan." },
  { id: "lainnya", name: "Profesional Lainnya", focus: "Tantangan dan peluang sesuai bidang Anda", persona: "Tanyakan bidang pengguna dan tujuan terlebih dahulu; jangan mengasumsikan profesinya." },
];

export const professionPersona = (p: Profession) => `${base}\nPeran pengguna: ${p.name}. ${p.persona}\nAlur: Diagnosis -> Eksplorasi -> Blueprint. Di Diagnosis, rangkum masalah dan ajukan paling banyak 5 pertanyaan klarifikasi. Di Eksplorasi, bandingkan opsi dengan kelebihan, risiko, dan bukti yang dibutuhkan. Di Blueprint, susun rencana tindak terstruktur.`;

const TAG = /\n*\[PUB-KONSULTASI profesi=([a-z0-9-]+) tahap=(diagnosis|eksplorasi|blueprint)\]\s*$/;
export const tagQuestion = (text: string, prof: string, stage: StageId) => `${text.trim()}\n\n[PUB-KONSULTASI profesi=${prof} tahap=${stage}]`;
export const stripTag = (text: string) => text.replace(TAG, "");

export interface FlowState { professionId: string | null; stage: StageId; completed: StageId[]; tagged: boolean }

/** Derive profession + stage purely from persisted messages. A stage counts only when an assistant reply follows it. */
export function deriveFlow(messages: Msg[]): FlowState {
  let professionId: string | null = null;
  const completed: StageId[] = [];
  let tagged = false;
  messages.forEach((m, i) => {
    if (m.role !== "user") return;
    const hit = m.content.match(TAG);
    if (!hit) return;
    tagged = true;
    professionId ??= hit[1];
    const next = messages[i + 1];
    const s = hit[2] as StageId;
    if (next?.role === "assistant" && next.content.trim() && !completed.includes(s)) completed.push(s);
  });
  const order: StageId[] = ["diagnosis", "eksplorasi", "blueprint"];
  const lastIdx = Math.max(-1, ...completed.map(s => order.indexOf(s)));
  const stage = order[Math.min(lastIdx + 1, 2)];
  return { professionId, stage, completed, tagged };
}

export const BLUEPRINT_REQUEST = `Susun BLUEPRINT final berdasarkan diagnosis dan eksplorasi di atas, dalam format Markdown:
1. Ringkasan masalah (maks 4 kalimat).
2. Tabel prioritas tindakan: No | Tindakan | Prioritas (Tinggi/Sedang/Rendah) | Penanggung jawab (peran) | Tenggat (minggu ke-) | Bukti keberhasilan.
3. Bukti yang sudah ada vs celah bukti: sebut dokumen/data yang perlu dikumpulkan.
4. Risiko bila tidak ditindaklanjuti dan indikator peringatan dini.
5. Asumsi yang Anda pakai dan pertanyaan yang masih terbuka.
Jangan menyatakan status sertifikasi atau kepatuhan sebagai fakta bila tidak didukung data.`;

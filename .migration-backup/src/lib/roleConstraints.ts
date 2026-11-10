/**
 * Role Constraints / Conflict & Overlap Detector
 * 
 * Aturan rangkap jabatan personil manajerial BUJK berdasarkan
 * Permen PUPR dan standar kualifikasi badan usaha konstruksi Indonesia.
 */

export type BUJKQualification = "kecil" | "menengah" | "besar";

export interface RoleConflict {
  position1: string;
  position2: string;
  rule: string;
  severity: "error" | "warning";
}

// Shortened labels for matching
const POS = {
  PJBU: "Penanggung Jawab Badan Usaha (PJBU) / Direktur",
  PJT: "Penanggung Jawab Teknik (PJT)",
  PJSKBU: "Penanggung Jawab Subklasifikasi (PJSKBU)",
  KEUANGAN: "Manajer Keuangan",
  LOGISTIK: "Manajer Logistik & Rantai Pasok",
  PENGADAAN: "Manajer Pengadaan / Tender",
  ADMIN: "Manajer Administrasi",
  K3: "Petugas K3",
} as const;

// Incompatible pairs: [posA, posB, rule, severity, maxQualification]
// maxQualification = the highest qualification where this conflict applies
// null = applies to all qualifications
const CONFLICT_RULES: Array<{
  pos1: string;
  pos2: string;
  rule: string;
  severity: "error" | "warning";
  appliesTo: BUJKQualification[];
}> = [
  // PJBU tidak boleh merangkap sebagai PJT (semua kualifikasi)
  {
    pos1: POS.PJBU,
    pos2: POS.PJT,
    rule: "PJBU/Direktur tidak boleh merangkap sebagai PJT sesuai Permen PUPR No. 8/2019.",
    severity: "error",
    appliesTo: ["kecil", "menengah", "besar"],
  },
  // PJBU tidak boleh merangkap sebagai PJSKBU (menengah & besar)
  {
    pos1: POS.PJBU,
    pos2: POS.PJSKBU,
    rule: "PJBU tidak boleh merangkap sebagai PJSKBU pada kualifikasi menengah dan besar.",
    severity: "error",
    appliesTo: ["menengah", "besar"],
  },
  // PJBU boleh merangkap PJSKBU hanya pada kualifikasi kecil (warning)
  {
    pos1: POS.PJBU,
    pos2: POS.PJSKBU,
    rule: "PJBU merangkap PJSKBU hanya diizinkan pada kualifikasi kecil dengan batasan 1 subklasifikasi.",
    severity: "warning",
    appliesTo: ["kecil"],
  },
  // PJT tidak boleh merangkap Petugas K3 (menengah & besar)
  {
    pos1: POS.PJT,
    pos2: POS.K3,
    rule: "PJT tidak boleh merangkap sebagai Petugas K3 pada kualifikasi menengah dan besar.",
    severity: "error",
    appliesTo: ["menengah", "besar"],
  },
  // Manajer Keuangan tidak boleh merangkap Manajer Pengadaan (semua)
  {
    pos1: POS.KEUANGAN,
    pos2: POS.PENGADAAN,
    rule: "Manajer Keuangan tidak boleh merangkap Manajer Pengadaan untuk menjaga prinsip segregation of duties.",
    severity: "error",
    appliesTo: ["kecil", "menengah", "besar"],
  },
  // Manajer Logistik merangkap Manajer Pengadaan (warning untuk besar)
  {
    pos1: POS.LOGISTIK,
    pos2: POS.PENGADAAN,
    rule: "Manajer Logistik merangkap Manajer Pengadaan tidak direkomendasikan pada kualifikasi besar.",
    severity: "warning",
    appliesTo: ["besar"],
  },
  // Manajer Administrasi merangkap Manajer Keuangan (warning untuk menengah & besar)
  {
    pos1: POS.ADMIN,
    pos2: POS.KEUANGAN,
    rule: "Manajer Administrasi merangkap Manajer Keuangan tidak direkomendasikan pada kualifikasi menengah dan besar.",
    severity: "warning",
    appliesTo: ["menengah", "besar"],
  },
];

/**
 * Detect role conflicts given a list of positions held within the same company.
 */
export function detectConflicts(
  positions: string[],
  qualification: BUJKQualification = "menengah"
): RoleConflict[] {
  const conflicts: RoleConflict[] = [];
  
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      for (const rule of CONFLICT_RULES) {
        if (!rule.appliesTo.includes(qualification)) continue;
        
        const match =
          (positions[i] === rule.pos1 && positions[j] === rule.pos2) ||
          (positions[i] === rule.pos2 && positions[j] === rule.pos1);
        
        if (match) {
          conflicts.push({
            position1: positions[i],
            position2: positions[j],
            rule: rule.rule,
            severity: rule.severity,
          });
        }
      }
    }
  }
  
  return conflicts;
}

/**
 * Get all positions that would conflict with a given position.
 */
export function getConflictingPositions(
  position: string,
  qualification: BUJKQualification = "menengah"
): Array<{ position: string; rule: string; severity: "error" | "warning" }> {
  const results: Array<{ position: string; rule: string; severity: "error" | "warning" }> = [];
  
  for (const rule of CONFLICT_RULES) {
    if (!rule.appliesTo.includes(qualification)) continue;
    
    if (rule.pos1 === position) {
      results.push({ position: rule.pos2, rule: rule.rule, severity: rule.severity });
    } else if (rule.pos2 === position) {
      results.push({ position: rule.pos1, rule: rule.rule, severity: rule.severity });
    }
  }
  
  return results;
}

/**
 * Short label for position display
 */
export function getShortPosition(position: string): string {
  const map: Record<string, string> = {
    [POS.PJBU]: "PJBU/Direktur",
    [POS.PJT]: "PJT",
    [POS.PJSKBU]: "PJSKBU",
    [POS.KEUANGAN]: "Manajer Keuangan",
    [POS.LOGISTIK]: "Manajer Logistik",
    [POS.PENGADAAN]: "Manajer Pengadaan",
    [POS.ADMIN]: "Manajer Administrasi",
    [POS.K3]: "Petugas K3",
  };
  return map[position] || position;
}

export const QUALIFICATION_OPTIONS: { value: BUJKQualification; label: string }[] = [
  { value: "kecil", label: "Kecil" },
  { value: "menengah", label: "Menengah" },
  { value: "besar", label: "Besar" },
];

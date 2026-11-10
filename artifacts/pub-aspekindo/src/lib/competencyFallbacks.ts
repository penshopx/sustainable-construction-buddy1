const DATE_FORMATS = {
  short: { day: "numeric", month: "short" },
  long: { day: "numeric", month: "long", year: "numeric" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

export function formatAssessmentDate(
  completedAt: string | null,
  style: keyof typeof DATE_FORMATS,
): string {
  if (!completedAt) return "Tanggal belum tersedia";

  const date = new Date(completedAt);
  if (Number.isNaN(date.getTime())) return "Tanggal belum tersedia";

  return date.toLocaleDateString("id-ID", DATE_FORMATS[style]);
}

export function assessmentLevel(
  determinedLevel: string | null,
  fallback: "Pemula" | "Belum ditentukan",
): string {
  return determinedLevel?.trim() || fallback;
}
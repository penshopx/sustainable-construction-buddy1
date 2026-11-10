import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, FileText, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner-toast";
import * as XLSX from "xlsx";
import { PANCEK_PILLARS } from "@/lib/pancekIndicators";

interface PancekImportProps {
  onImport: (answers: Record<string, boolean>, meta?: { company_name?: string; npwp?: string; nib?: string }) => void;
  disabled?: boolean;
}

// All indicator codes for matching
const ALL_INDICATOR_CODES = PANCEK_PILLARS.flatMap(p => p.indicators.map(i => i.code));

// Normalize code variants from Jaga.id (e.g. "K.1.a" or "K1a" or "K-1-a")
function normalizeCode(raw: string): string | null {
  const cleaned = raw.trim().toUpperCase().replace(/[\s\-_]/g, ".");
  // Try exact match first
  const exact = ALL_INDICATOR_CODES.find(c => c.toUpperCase() === cleaned);
  if (exact) return exact;

  // Try stripping dots: K1A -> K.1.a
  const stripped = cleaned.replace(/\./g, "");
  const match = ALL_INDICATOR_CODES.find(c => c.toUpperCase().replace(/\./g, "") === stripped);
  return match || null;
}

function isPositiveValue(val: unknown): boolean {
  if (val === true || val === 1) return true;
  if (typeof val === "string") {
    const lower = val.trim().toLowerCase();
    return ["ya", "yes", "v", "✓", "✔", "√", "1", "true", "ada", "sesuai", "terpenuhi", "comply", "compliant"].includes(lower);
  }
  return false;
}

function parseExcelFile(file: File): Promise<{ answers: Record<string, boolean>; meta: { company_name?: string; npwp?: string; nib?: string }; matchedCount: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        const answers: Record<string, boolean> = {};
        const meta: { company_name?: string; npwp?: string; nib?: string } = {};
        let matchedCount = 0;

        // Search through all sheets
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

          for (const row of json) {
            const values = Object.values(row);
            const keys = Object.keys(row);

            // Try to find indicator code in any column
            for (let i = 0; i < values.length; i++) {
              const cellVal = String(values[i] || "");
              const code = normalizeCode(cellVal);
              if (code) {
                // Check if any subsequent column has a positive value
                const hasPositive = values.slice(i + 1).some(isPositiveValue);
                if (hasPositive) {
                  answers[code] = true;
                  matchedCount++;
                }
                break;
              }
            }

            // Try to extract metadata
            for (let i = 0; i < keys.length; i++) {
              const key = keys[i].toLowerCase();
              const val = String(values[i] || "").trim();
              if (!val) continue;

              if (key.includes("nama") && (key.includes("perusahaan") || key.includes("badan") || key.includes("usaha"))) {
                meta.company_name = val;
              } else if (key.includes("npwp")) {
                meta.npwp = val;
              } else if (key.includes("nib")) {
                meta.nib = val;
              }
            }

            // Also check row values for metadata patterns
            for (let i = 0; i < values.length; i++) {
              const cellStr = String(values[i] || "").toLowerCase();
              const nextVal = values[i + 1] ? String(values[i + 1]).trim() : "";
              if (!nextVal) continue;

              if ((cellStr.includes("nama") && (cellStr.includes("perusahaan") || cellStr.includes("badan usaha"))) || cellStr.includes("company")) {
                meta.company_name = nextVal;
              } else if (cellStr.includes("npwp")) {
                meta.npwp = nextVal;
              } else if (cellStr.includes("nib") || cellStr.includes("nomor induk berusaha")) {
                meta.nib = nextVal;
              }
            }
          }
        }

        resolve({ answers, meta, matchedCount });
      } catch (err) {
        reject(new Error("Gagal membaca file Excel. Pastikan format file benar."));
      }
    };
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.readAsArrayBuffer(file);
  });
}

function parsePDFText(text: string): { answers: Record<string, boolean>; meta: { company_name?: string; npwp?: string; nib?: string }; matchedCount: number } {
  const answers: Record<string, boolean> = {};
  const meta: { company_name?: string; npwp?: string; nib?: string } = {};
  let matchedCount = 0;

  const lines = text.split("\n");

  for (const line of lines) {
    // Check each indicator code against this line
    for (const code of ALL_INDICATOR_CODES) {
      if (line.includes(code)) {
        // If the line also contains positive markers
        const afterCode = line.substring(line.indexOf(code) + code.length);
        if (/\b(ya|yes|ada|sesuai|terpenuhi|comply|✓|✔|√|v)\b/i.test(afterCode) || /\b1\b/.test(afterCode)) {
          answers[code] = true;
          matchedCount++;
        }
      }
    }

    // Metadata extraction
    const lower = line.toLowerCase();
    if (lower.includes("nama") && (lower.includes("perusahaan") || lower.includes("badan usaha"))) {
      const parts = line.split(/[:=]/);
      if (parts[1]) meta.company_name = parts[1].trim();
    }
    if (lower.includes("npwp")) {
      const parts = line.split(/[:=]/);
      if (parts[1]) meta.npwp = parts[1].trim();
    }
    if (lower.includes("nib") || lower.includes("nomor induk berusaha")) {
      const parts = line.split(/[:=]/);
      if (parts[1]) meta.nib = parts[1].trim();
    }
  }

  return { answers, meta, matchedCount };
}

export default function PancekImport({ onImport, disabled }: PancekImportProps) {
  const [importing, setImporting] = useState(false);
  const [lastResult, setLastResult] = useState<{ matchedCount: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    const isExcel = ["xlsx", "xls", "csv"].includes(ext || "");
    const isPdf = ext === "pdf";

    if (!isExcel && !isPdf) {
      toast.error("Format file tidak didukung. Gunakan file Excel (.xlsx, .xls, .csv) atau PDF.");
      return;
    }

    setImporting(true);
    try {
      let answers: Record<string, boolean> = {};
      let meta: { company_name?: string; npwp?: string; nib?: string } = {};
      let matchedCount = 0;

      if (isExcel) {
        const result = await parseExcelFile(file);
        answers = result.answers;
        meta = result.meta;
        matchedCount = result.matchedCount;
      } else if (isPdf) {
        // For PDF, we read the text content using FileReader
        // Note: Basic PDF text extraction - complex PDFs may need server-side processing
        toast.info("Membaca file PDF... Untuk hasil terbaik, gunakan format Excel.");
        
        // Use a simple approach - try to read as text
        const text = await file.text();
        const result = parsePDFText(text);
        answers = result.answers;
        meta = result.meta;
        matchedCount = result.matchedCount;

        if (matchedCount === 0) {
          toast.warning("Tidak dapat membaca konten PDF. File PDF dari Jaga.id mungkin berformat gambar. Coba export dalam format Excel.");
          setImporting(false);
          return;
        }
      }

      if (matchedCount === 0) {
        toast.warning("Tidak ditemukan indikator PANCEK dalam file. Pastikan file berisi data dari Jaga.id dengan kode indikator (K.1.a, P.1.a, dll).");
      } else {
        onImport(answers, meta);
        setLastResult({ matchedCount, total: ALL_INDICATOR_CODES.length });
        toast.success(`Berhasil mengimpor ${matchedCount} indikator dari ${ALL_INDICATOR_CODES.length} total indikator.`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal mengimpor file");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Card className="border-dashed border-2 border-pub-amber/30 bg-pub-amber/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-heading flex items-center gap-2">
          <Upload className="w-4 h-4 text-pub-amber" />
          Import dari Jaga.id
        </CardTitle>
        <CardDescription className="text-xs">
          Upload lembar verifikasi PANCEK yang di-export dari platform Jaga.id (format Excel atau PDF)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv,.pdf"
            onChange={handleFile}
            disabled={disabled || importing}
            className="hidden"
            id="pancek-import-file"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={disabled || importing}
            className="gap-2"
          >
            {importing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            {importing ? "Mengimpor..." : "Pilih File"}
          </Button>
          <div className="flex gap-1">
            <Badge variant="outline" className="text-[10px]">
              <FileSpreadsheet className="w-3 h-3 mr-1" />
              .xlsx
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              <FileSpreadsheet className="w-3 h-3 mr-1" />
              .xls
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              <FileText className="w-3 h-3 mr-1" />
              .csv
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              <FileText className="w-3 h-3 mr-1" />
              .pdf
            </Badge>
          </div>
        </div>

        {lastResult && (
          <div className="flex items-center gap-2 text-xs">
            {lastResult.matchedCount > 0 ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-pub-emerald" />
                <span className="text-pub-emerald font-medium">
                  {lastResult.matchedCount}/{lastResult.total} indikator berhasil diimpor
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <span className="text-destructive">Tidak ada indikator yang cocok</span>
              </>
            )}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground">
          💡 Sistem akan mencocokkan kode indikator (K.1.a, P.1.a, D.1.a, dll) dari file Jaga.id secara otomatis.
          Data yang sudah ada akan ditimpa dengan hasil impor.
        </p>
      </CardContent>
    </Card>
  );
}

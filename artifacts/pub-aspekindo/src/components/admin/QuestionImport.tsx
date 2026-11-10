import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

interface Domain {
  id: string;
  name: string;
}

interface ParsedQuestion {
  question_text: string;
  difficulty: string;
  domain_name: string;
  domain_id?: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string; // A, B, C, D
  correct_answer_idx?: number;
  explanation: string;
  errors: string[];
}

const VALID_DIFFICULTIES = ["Pemula", "Muda", "Madya", "Utama"];
const VALID_ANSWERS = ["A", "B", "C", "D"];

const rowSchema = z.object({
  question_text: z.string().trim().min(10, "Pertanyaan minimal 10 karakter").max(1000, "Pertanyaan maksimal 1000 karakter"),
  difficulty: z.string().trim().refine(v => VALID_DIFFICULTIES.includes(v), `Kesulitan harus: ${VALID_DIFFICULTIES.join(", ")}`),
  domain_name: z.string().trim().min(1, "Domain wajib diisi"),
  option_a: z.string().trim().min(1, "Opsi A wajib diisi").max(500),
  option_b: z.string().trim().min(1, "Opsi B wajib diisi").max(500),
  option_c: z.string().trim().min(1, "Opsi C wajib diisi").max(500),
  option_d: z.string().trim().min(1, "Opsi D wajib diisi").max(500),
  correct_answer: z.string().trim().toUpperCase().refine(v => VALID_ANSWERS.includes(v), "Jawaban benar harus A, B, C, atau D"),
  explanation: z.string().trim().max(2000, "Penjelasan maksimal 2000 karakter").default(""),
});

interface QuestionImportProps {
  domains: Domain[];
  onImportDone: () => void;
}

export default function QuestionImport({ domains, onImportDone }: QuestionImportProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [parsed, setParsed] = useState<ParsedQuestion[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const domainMap = Object.fromEntries(domains.map(d => [d.name.toLowerCase().trim(), d.id]));

  const parseFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

        if (rows.length === 0) {
          toast({ title: "File kosong", description: "Tidak ada data ditemukan di file.", variant: "destructive" });
          return;
        }

        if (rows.length > 200) {
          toast({ title: "Terlalu banyak soal", description: "Maksimal 200 soal per import.", variant: "destructive" });
          return;
        }

        // Normalize column names (case-insensitive, trim)
        const normalizedRows = rows.map(row => {
          const normalized: Record<string, string> = {};
          Object.entries(row).forEach(([key, val]) => {
            normalized[key.toLowerCase().trim().replace(/\s+/g, "_")] = String(val ?? "").trim();
          });
          return normalized;
        });

        const questions: ParsedQuestion[] = normalizedRows.map((row) => {
          const mapped = {
            question_text: row.pertanyaan || row.question_text || row.question || row.soal || "",
            difficulty: row.kesulitan || row.difficulty || row.level || "",
            domain_name: row.domain || row.domain_name || row.kategori || "",
            option_a: row.opsi_a || row.option_a || row.a || "",
            option_b: row.opsi_b || row.option_b || row.b || "",
            option_c: row.opsi_c || row.option_c || row.c || "",
            option_d: row.opsi_d || row.option_d || row.d || "",
            correct_answer: row.jawaban_benar || row.correct_answer || row.jawaban || row.answer || "",
            explanation: row.penjelasan || row.explanation || row.keterangan || "",
          };

          const errors: string[] = [];
          const result = rowSchema.safeParse(mapped);
          if (!result.success) {
            result.error.errors.forEach(err => errors.push(err.message));
          }

          // Check domain exists
          const domainId = domainMap[mapped.domain_name.toLowerCase().trim()];
          if (!domainId && mapped.domain_name) {
            errors.push(`Domain "${mapped.domain_name}" tidak ditemukan`);
          }

          const answerIdx = VALID_ANSWERS.indexOf(mapped.correct_answer.toUpperCase());

          return {
            ...mapped,
            domain_id: domainId,
            correct_answer_idx: answerIdx >= 0 ? answerIdx : undefined,
            errors,
          };
        });

        setParsed(questions);
        setFileName(file.name);
        setDialogOpen(true);
      } catch {
        toast({ title: "Gagal membaca file", description: "Pastikan file berformat CSV atau Excel (.xlsx/.xls).", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "File terlalu besar", description: "Maksimal 5MB.", variant: "destructive" });
        return;
      }
      parseFile(file);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const validQuestions = parsed.filter(q => q.errors.length === 0 && q.domain_id && q.correct_answer_idx !== undefined);
  const invalidQuestions = parsed.filter(q => q.errors.length > 0 || !q.domain_id || q.correct_answer_idx === undefined);

  const handleImport = async () => {
    if (validQuestions.length === 0) return;
    setImporting(true);

    const payload = validQuestions.map(q => ({
      question_text: q.question_text,
      difficulty: q.difficulty,
      domain_id: q.domain_id!,
      options: [q.option_a, q.option_b, q.option_c, q.option_d],
      correct_answer: q.correct_answer_idx!,
      explanation: q.explanation,
    }));

    // Insert in batches of 50
    let inserted = 0;
    for (let i = 0; i < payload.length; i += 50) {
      const batch = payload.slice(i, i + 50);
      const { error } = await supabase.from("questions").insert(batch);
      if (error) {
        toast({ title: "Gagal import", description: error.message, variant: "destructive" });
        setImporting(false);
        return;
      }
      inserted += batch.length;
    }

    toast({ title: `${inserted} soal berhasil diimport` });
    setImporting(false);
    setDialogOpen(false);
    setParsed([]);
    onImportDone();
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        pertanyaan: "Contoh pertanyaan soal?",
        domain: domains[0]?.name || "Manajemen Proyek",
        kesulitan: "Pemula",
        opsi_a: "Jawaban A",
        opsi_b: "Jawaban B",
        opsi_c: "Jawaban C",
        opsi_d: "Jawaban D",
        jawaban_benar: "B",
        penjelasan: "Penjelasan mengapa B adalah jawaban yang benar.",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Soal");

    // Set column widths
    ws["!cols"] = [
      { wch: 40 }, { wch: 20 }, { wch: 12 },
      { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
      { wch: 14 }, { wch: 40 },
    ];

    XLSX.writeFile(wb, "template_import_soal.xlsx");
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="w-4 h-4 mr-2" /> Template
        </Button>
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="w-4 h-4 mr-2" /> Import CSV/Excel
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-accent" />
              Preview Import: {fileName}
            </DialogTitle>
            <DialogDescription>
              Review data sebelum mengimport ke database
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-pub-emerald/10 text-pub-emerald text-sm font-medium">
              <CheckCircle2 className="w-4 h-4" />
              {validQuestions.length} valid
            </div>
            {invalidQuestions.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">
                <AlertCircle className="w-4 h-4" />
                {invalidQuestions.length} bermasalah (akan dilewati)
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead className="w-[35%]">Pertanyaan</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Kesulitan</TableHead>
                  <TableHead>Jawaban</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsed.map((q, i) => {
                  const hasErrors = q.errors.length > 0 || !q.domain_id || q.correct_answer_idx === undefined;
                  return (
                    <TableRow key={i} className={hasErrors ? "bg-destructive/5" : ""}>
                      <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                      <TableCell className="font-medium text-sm truncate max-w-xs">
                        {q.question_text || <span className="text-muted-foreground italic">kosong</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={q.domain_id ? "secondary" : "destructive"} className="text-xs">
                          {q.domain_name || "?"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{q.difficulty || "?"}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{q.correct_answer || "?"}</TableCell>
                      <TableCell>
                        {hasErrors ? (
                          <div className="flex items-start gap-1">
                            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                            <div className="text-xs text-destructive">
                              {q.errors.map((e, j) => <div key={j}>{e}</div>)}
                              {!q.domain_id && q.domain_name && <div>Domain tidak ditemukan</div>}
                            </div>
                          </div>
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-pub-emerald" />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {parsed.length > 0 && (
            <div className="text-xs text-muted-foreground mt-2">
              Domain yang tersedia: {domains.map(d => d.name).join(", ")}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleImport} disabled={importing || validQuestions.length === 0}>
              {importing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Mengimport...</>
              ) : (
                <>Import {validQuestions.length} Soal</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner-toast";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface ImportRow {
  full_name: string;
  company: string;
  position: string;
  email: string;
  phone: string;
  attendance_status: string;
  notes: string;
  valid: boolean;
  error?: string;
}

function normalizeHeader(h: string): string {
  const s = h.toLowerCase().trim();
  if (s.includes("nama")) return "nama";
  if (s.includes("perusahaan") || s.includes("company") || s.includes("instansi")) return "perusahaan";
  if (s.includes("jabatan") || s.includes("position")) return "jabatan";
  if (s.includes("email") || s.includes("e-mail")) return "email";
  if (s.includes("telp") || s.includes("phone") || s.includes("hp") || s.includes("telepon") || s.includes("no.")) return "telepon";
  if (s.includes("status") || s.includes("kehadiran")) return "status";
  if (s.includes("catatan") || s.includes("note") || s.includes("keterangan")) return "catatan";
  return s;
}

function normalizeStatus(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (s === "hadir" || s === "attended") return "attended";
  if (s === "tidak hadir" || s === "absent") return "absent";
  return "registered";
}

interface Props {
  programId: string;
}

export function DetailParticipantImport({ programId }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const reset = () => { setRows([]); setFileName(""); if (fileRef.current) fileRef.current.value = ""; };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Ukuran file maksimal 5MB"); return; }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        if (json.length === 0) { toast.error("File kosong"); return; }
        if (json.length > 500) { toast.error("Maksimal 500 baris"); return; }

        const headerMap: Record<string, string> = {};
        Object.keys(json[0]).forEach((key) => { headerMap[normalizeHeader(key)] = key; });

        const parsed: ImportRow[] = json.map((row) => {
          const fullName = String(row[headerMap["nama"]] || "").trim().slice(0, 100);
          return {
            full_name: fullName,
            company: String(row[headerMap["perusahaan"]] || "").trim().slice(0, 100),
            position: String(row[headerMap["jabatan"]] || "").trim().slice(0, 100),
            email: String(row[headerMap["email"]] || "").trim().slice(0, 255),
            phone: String(row[headerMap["telepon"]] || "").trim().slice(0, 20),
            attendance_status: normalizeStatus(String(row[headerMap["status"]] || "")),
            notes: String(row[headerMap["catatan"]] || "").trim().slice(0, 500),
            valid: fullName.length > 0,
            error: fullName.length === 0 ? "Nama wajib diisi" : undefined,
          };
        });
        setRows(parsed);
        toast.success(`${parsed.length} baris berhasil dibaca`);
      } catch { toast.error("Gagal membaca file"); }
    };
    reader.readAsArrayBuffer(file);
  };

  const validRows = rows.filter((r) => r.valid);
  const invalidRows = rows.filter((r) => !r.valid);

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      const chunkSize = 50;
      let inserted = 0;
      for (let i = 0; i < validRows.length; i += chunkSize) {
        const chunk = validRows.slice(i, i + chunkSize).map((r) => ({
          program_id: programId, full_name: r.full_name, company: r.company,
          position: r.position, email: r.email, phone: r.phone,
          attendance_status: r.attendance_status, notes: r.notes,
        }));
        const { error } = await supabase.from("pub_program_participants").insert(chunk);
        if (error) throw error;
        inserted += chunk.length;
      }
      qc.invalidateQueries({ queryKey: ["pub-program-participants"] });
      toast.success(`${inserted} peserta berhasil diimport`);
      reset();
      setOpen(false);
    } catch (err: unknown) { toast.error(`Gagal import: ${err instanceof Error ? err.message : "Unknown error"}`); }
    setImporting(false);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Nama", "Perusahaan", "Jabatan", "Email", "Telepon", "Status", "Catatan"],
      ["Ahmad Fauzi", "PT Konstruksi Mandiri", "Project Manager", "ahmad@email.com", "08123456789", "Terdaftar", "Batch 1"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Peserta");
    XLSX.writeFile(wb, "template-peserta.xlsx");
  };

  const statusLabel: Record<string, string> = { registered: "Terdaftar", attended: "Hadir", absent: "Tidak Hadir" };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
          <Upload className="w-3.5 h-3.5" /> Import Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" /> Import Peserta dari Excel/CSV
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Upload File</label>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile}
              className="text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:text-xs file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer" />
            <div className="flex items-center gap-2 mt-2">
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={downloadTemplate}>
                <FileSpreadsheet className="w-3 h-3 mr-1" /> Download template
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Kolom wajib: <strong>Nama</strong>. Opsional: Perusahaan, Jabatan, Email, Telepon, Status, Catatan.
            </p>
          </div>

          {rows.length > 0 && (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Preview ({rows.length} baris)</label>
                  <div className="flex items-center gap-2">
                    {validRows.length > 0 && <Badge variant="outline" className="gap-1 text-pub-emerald"><CheckCircle2 className="w-3 h-3" /> {validRows.length} valid</Badge>}
                    {invalidRows.length > 0 && <Badge variant="outline" className="gap-1 text-destructive"><AlertCircle className="w-3 h-3" /> {invalidRows.length} error</Badge>}
                  </div>
                </div>
                <div className="border rounded-md overflow-auto max-h-60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">No</TableHead>
                        <TableHead className="text-[10px]">Nama</TableHead>
                        <TableHead className="text-[10px]">Perusahaan</TableHead>
                        <TableHead className="text-[10px]">Email</TableHead>
                        <TableHead className="text-[10px]">Status</TableHead>
                        <TableHead className="text-[10px]">Valid</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.slice(0, 100).map((r, i) => (
                        <TableRow key={i} className={r.valid ? "" : "bg-destructive/5"}>
                          <TableCell className="text-[10px]">{i + 1}</TableCell>
                          <TableCell className="text-[10px] font-medium">{r.full_name || "-"}</TableCell>
                          <TableCell className="text-[10px]">{r.company || "-"}</TableCell>
                          <TableCell className="text-[10px]">{r.email || "-"}</TableCell>
                          <TableCell className="text-[10px]">{statusLabel[r.attendance_status] || "Terdaftar"}</TableCell>
                          <TableCell>
                            {r.valid ? <CheckCircle2 className="w-3.5 h-3.5 text-pub-emerald" /> : <span className="text-[10px] text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {r.error}</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <Button className="w-full gap-2" disabled={importing || validRows.length === 0} onClick={handleImport}>
                {importing ? "Mengimport..." : `Import ${validRows.length} Peserta`}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

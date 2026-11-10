import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export interface Certificate {
  id: string;
  level: string;
  certificate_number: string;
  issued_at: string;
  full_name: string;
  company: string;
  position: string;
  company_logo_url: string;
  signature_url: string;
  module_name: string;
}

const levelColor = (level: string) => {
  switch (level) {
    case "Utama": return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
    case "Madya": return "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200";
    case "Muda": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "Pemula": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200";
    default: return "bg-muted text-muted-foreground";
  }
};

interface Props {
  certificates: Certificate[];
  onDownload: (cert: Certificate) => void;
}

export default function CertificateHistoryTable({ certificates, onDownload }: Props) {
  if (certificates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
        Belum ada sertifikat yang diterbitkan.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>No. Sertifikat</TableHead>
            <TableHead>Nama</TableHead>
            <TableHead>Modul</TableHead>
            <TableHead>Level</TableHead>
            <TableHead>Diterbitkan</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {certificates.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-mono text-xs">{c.certificate_number}</TableCell>
              <TableCell className="font-medium">{c.full_name || "-"}</TableCell>
              <TableCell className="text-sm">{c.module_name || "-"}</TableCell>
              <TableCell><Badge className={levelColor(c.level)}>{c.level}</Badge></TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {new Date(c.issued_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline" onClick={() => onDownload(c)}>
                  <Download className="w-4 h-4 mr-1" /> Download
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

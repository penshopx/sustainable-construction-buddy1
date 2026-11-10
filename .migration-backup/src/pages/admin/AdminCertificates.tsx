import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Award, Download } from "lucide-react";

interface Certificate {
  id: string;
  user_id: string;
  level: string;
  certificate_number: string;
  issued_at: string;
  full_name: string;
  company: string;
  position: string;
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

export default function AdminCertificates() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("certificates").select("*").order("issued_at", { ascending: false });
      if (data) setCertificates(data as Certificate[]);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = certificates.filter(
    (c) =>
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      c.company.toLowerCase().includes(search.toLowerCase()) ||
      c.certificate_number.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-heading text-foreground flex items-center gap-2">
            <Award className="w-6 h-6 text-accent" /> Sertifikat Diterbitkan
          </h2>
          <p className="text-sm text-muted-foreground">{certificates.length} sertifikat</p>
        </div>
        <Button
          variant="outline"
          disabled={filtered.length === 0}
          onClick={() => {
            const headers = ["Nama", "Perusahaan", "Jabatan", "Level", "No. Sertifikat", "Diterbitkan"];
            const rows = filtered.map((c) => [
              c.full_name || "-",
              c.company || "-",
              c.position || "-",
              c.level,
              c.certificate_number,
              new Date(c.issued_at).toLocaleDateString("id-ID"),
            ]);
            const csv = [headers, ...rows].map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
            const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `sertifikat-${new Date().toISOString().slice(0, 10)}.csv`;
            link.click();
          }}
        >
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Cari nama, perusahaan, atau nomor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Perusahaan</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>No. Sertifikat</TableHead>
              <TableHead>Diterbitkan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Memuat...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Belum ada sertifikat</TableCell></TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.full_name || "-"}</TableCell>
                  <TableCell>{c.company || "-"}</TableCell>
                  <TableCell><Badge className={levelColor(c.level)}>{c.level}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{c.certificate_number}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{new Date(c.issued_at).toLocaleDateString("id-ID")}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

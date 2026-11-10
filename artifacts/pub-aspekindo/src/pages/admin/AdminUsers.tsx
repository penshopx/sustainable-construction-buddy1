import { useEffect, useState } from "react";
import { canonicalCompanies } from "@/lib/ruang-simpan";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Users, Download } from "lucide-react";

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  company: string;
  position: string;
  current_level: string;
  total_score: number;
  created_at: string;
}

export default function AdminUsers() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (data) setProfiles(await canonicalCompanies(data));
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = profiles.filter(
    (p) =>
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      p.company.toLowerCase().includes(search.toLowerCase())
  );

  const levelColor = (level: string) => {
    switch (level) {
      case "Utama": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "Madya": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "Muda": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-heading text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-accent" /> Data Pengguna
          </h2>
          <p className="text-sm text-muted-foreground">{profiles.length} pengguna terdaftar</p>
        </div>
        <Button
          variant="outline"
          disabled={filtered.length === 0}
          onClick={() => {
            const headers = ["Nama", "Perusahaan", "Jabatan", "Level", "Skor", "Bergabung"];
            const rows = filtered.map((p) => [
              p.full_name || "-",
              p.company || "-",
              p.position || "-",
              p.current_level,
              String(p.total_score),
              new Date(p.created_at).toLocaleDateString("id-ID"),
            ]);
            const csv = [headers, ...rows].map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
            const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `pengguna-${new Date().toISOString().slice(0, 10)}.csv`;
            link.click();
          }}
        >
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Cari nama atau perusahaan..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Perusahaan</TableHead>
              <TableHead>Jabatan</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Skor</TableHead>
              <TableHead>Bergabung</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Memuat...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Tidak ada pengguna</TableCell></TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name || "-"}</TableCell>
                  <TableCell>{p.company || "-"}</TableCell>
                  <TableCell>{p.position || "-"}</TableCell>
                  <TableCell><Badge className={levelColor(p.current_level)}>{p.current_level}</Badge></TableCell>
                  <TableCell>{p.total_score}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{new Date(p.created_at).toLocaleDateString("id-ID")}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

import { useState, useMemo } from "react";
import { Search, Users, Download, Clock, LogIn, LogOut, BadgeCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { usePubParticipantsDirectory, type PubParticipantEntry } from "@/hooks/usePubParticipantsDirectory";
import { useAdmin } from "@/hooks/useAdmin";
import AdminPesertaDialog from "@/components/directory/AdminPesertaDialog";

const statusConfig: Record<string, { label: string; color: string }> = {
  registered: { label: "Terdaftar", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  attended: { label: "Hadir", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  absent: { label: "Tidak Hadir", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
};

function fmtDateTime(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDate(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function PesertaPubDirectory() {
  const { isAdmin } = useAdmin();
  const { data: participants = [], isLoading } = usePubParticipantsDirectory();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");

  const programs = useMemo(() => {
    const map = new Map<string, string>();
    participants.forEach((p) => {
      if (p.program_title && p.program_title !== "-") map.set(p.program_id, p.program_title);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [participants]);

  const filtered = useMemo(() => {
    return participants.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        p.full_name.toLowerCase().includes(q) ||
        p.company.toLowerCase().includes(q) ||
        p.kta_number.toLowerCase().includes(q) ||
        (p.program_title || "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || p.attendance_status === statusFilter;
      const matchProgram = programFilter === "all" || p.program_id === programFilter;
      return matchSearch && matchStatus && matchProgram;
    });
  }, [participants, search, statusFilter, programFilter]);

  const stats = useMemo(() => ({
    total: participants.length,
    attended: participants.filter((p) => p.attendance_status === "attended").length,
    registered: participants.filter((p) => p.attendance_status === "registered").length,
    absent: participants.filter((p) => p.attendance_status === "absent").length,
  }), [participants]);

  const exportCsv = () => {
    const headers = ["No", "Nama", "Utusan BUJK", "No. KTA", "Program", "Status", "Check-In", "Check-Out"];
    const rows = filtered.map((p, i) => [
      i + 1,
      p.full_name,
      p.company,
      p.kta_number || "-",
      p.program_title || "-",
      statusConfig[p.attendance_status]?.label || p.attendance_status,
      p.checked_in_at ? new Date(p.checked_in_at).toLocaleString("id-ID") : "-",
      p.checked_out_at ? new Date(p.checked_out_at).toLocaleString("id-ID") : "-",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Peserta-PUB-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Peserta", value: stats.total, icon: Users, color: "text-primary" },
          { label: "Hadir", value: stats.attended, icon: BadgeCheck, color: "text-emerald-600" },
          { label: "Terdaftar", value: stats.registered, icon: Clock, color: "text-amber-600" },
          { label: "Tidak Hadir", value: stats.absent, icon: LogOut, color: "text-red-500" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-3 text-center">
            <s.icon className={`w-5 h-5 mx-auto mb-1 ${s.color}`} />
            <div className="text-xl font-bold font-heading text-foreground">{s.value}</div>
            <div className="text-[10px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama, perusahaan, KTA..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="attended">Hadir</SelectItem>
            <SelectItem value="registered">Terdaftar</SelectItem>
            <SelectItem value="absent">Tidak Hadir</SelectItem>
          </SelectContent>
        </Select>
        {programs.length > 1 && (
          <Select value={programFilter} onValueChange={setProgramFilter}>
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder="Program" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Program</SelectItem>
              {programs.map(([id, title]) => (
                <SelectItem key={id} value={id}>{title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="w-4 h-4" /> CSV
        </Button>
        {isAdmin && <AdminPesertaDialog mode="add" />}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-heading font-semibold">
            {participants.length === 0 ? "Belum ada peserta PUB" : "Tidak ada hasil yang cocok"}
          </p>
          <p className="text-sm">
            {participants.length === 0
              ? "Peserta akan muncul saat terdaftar pada Program & Kegiatan PUB."
              : "Coba ubah kata kunci atau filter."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10 text-center text-xs">No</TableHead>
                <TableHead className="text-xs">Nama Peserta</TableHead>
                <TableHead className="text-xs">Utusan BUJK</TableHead>
                <TableHead className="text-xs">No. KTA</TableHead>
                <TableHead className="text-xs">Program</TableHead>
                <TableHead className="text-xs text-center">Status</TableHead>
                <TableHead className="text-xs">
                  <div className="flex items-center gap-1"><LogIn className="w-3 h-3" /> Check-In</div>
                </TableHead>
                <TableHead className="text-xs">
                  <div className="flex items-center gap-1"><LogOut className="w-3 h-3" /> Check-Out</div>
                </TableHead>
                {isAdmin && <TableHead className="text-xs w-10"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p, i) => {
                const st = statusConfig[p.attendance_status] || { label: p.attendance_status, color: "bg-muted text-muted-foreground" };
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-center text-xs text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm text-foreground">{p.full_name || "-"}</div>
                      {p.position && <div className="text-[10px] text-muted-foreground">{p.position}</div>}
                    </TableCell>
                    <TableCell className="text-sm">{p.company || "-"}</TableCell>
                    <TableCell className="text-sm font-mono">{p.kta_number || "-"}</TableCell>
                    <TableCell>
                      <div className="text-sm">{p.program_title}</div>
                      {p.program_start_date && (
                        <div className="text-[10px] text-muted-foreground">{fmtDate(p.program_start_date)}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className={`text-[10px] ${st.color}`}>{st.label}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDateTime(p.checked_in_at)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDateTime(p.checked_out_at)}</TableCell>
                    {isAdmin && (
                      <TableCell className="p-1">
                        <AdminPesertaDialog mode="edit" participant={p} />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Menampilkan {filtered.length} dari {participants.length} peserta
        </p>
      )}
    </div>
  );
}

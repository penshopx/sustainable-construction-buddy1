import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Eye, Send, User, FileText, Clock, ThumbsUp, ThumbsDown, Search, Download } from "lucide-react";
import { useAdminInnovationProposals, useUpdateProposalStatus } from "@/hooks/useInnovations";
import { toast } from "@/components/ui/sonner-toast";
import * as XLSX from "xlsx";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-pub-amber/15 text-pub-amber",
  reviewed: "bg-pub-sky/15 text-pub-sky",
  approved: "bg-pub-emerald/15 text-pub-emerald",
  rejected: "bg-destructive/15 text-destructive",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  submitted: "Diajukan",
  reviewed: "Direview",
  approved: "Disetujui",
  rejected: "Ditolak",
};

export default function AdminInnovationReview() {
  const navigate = useNavigate();
  const { data: proposals = [], isLoading } = useAdminInnovationProposals();
  const updateStatus = useUpdateProposalStatus();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [action, setAction] = useState<"approved" | "rejected" | "reviewed" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const selected = proposals.find((p) => p.id === selectedId);

  const filtered = useMemo(() => {
    return proposals.filter((p) => {
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || 
        p.title.toLowerCase().includes(q) || 
        (p.submitter_name || "").toLowerCase().includes(q) ||
        (p.submitter_company || "").toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [proposals, statusFilter, searchQuery]);

  const openReview = (id: string, currentAction: "approved" | "rejected" | "reviewed") => {
    const p = proposals.find((x) => x.id === id);
    setSelectedId(id);
    setAction(currentAction);
    setNotes(p?.admin_notes || "");
  };

  const handleSubmit = async () => {
    if (!selectedId || !action) return;
    try {
      await updateStatus.mutateAsync({ id: selectedId, status: action, admin_notes: notes });
      toast.success(`Proposal ${statusLabels[action].toLowerCase()}`);
      setSelectedId(null);
      setAction(null);
      setNotes("");
    } catch {
      toast.error("Gagal mengubah status proposal");
    }
  };

  if (isLoading) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Card key={i} className="animate-pulse h-24" />)}</div>;
  }

  if (proposals.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Belum ada proposal inovasi yang diajukan.</p>
      </Card>
    );
  }

  const stats = {
    total: proposals.length,
    submitted: proposals.filter((p) => p.status === "submitted").length,
    reviewed: proposals.filter((p) => p.status === "reviewed").length,
    approved: proposals.filter((p) => p.status === "approved").length,
    rejected: proposals.filter((p) => p.status === "rejected").length,
  };

  const handleExportExcel = () => {
    const rows = filtered.map((p) => ({
      "Judul": p.title,
      "Pengaju": p.submitter_name || "",
      "Perusahaan": p.submitter_company || "",
      "Kategori": p.innovation_categories?.name || "",
      "Status": statusLabels[p.status] || p.status,
      "Lingkup": p.scope,
      "Dampak": p.expected_impact,
      "Catatan Admin": p.admin_notes,
      "Tanggal": new Date(p.created_at).toLocaleDateString("id-ID"),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Proposal Inovasi");
    XLSX.writeFile(wb, `proposal-inovasi-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Data berhasil diexport ke Excel");
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Proposal</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="w-9 h-9 rounded-lg bg-pub-amber/10 flex items-center justify-center">
              <Clock className="w-4.5 h-4.5 text-pub-amber" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.submitted + stats.reviewed}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="w-9 h-9 rounded-lg bg-pub-emerald/10 flex items-center justify-center">
              <ThumbsUp className="w-4.5 h-4.5 text-pub-emerald" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.approved}</p>
              <p className="text-xs text-muted-foreground">Disetujui</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
              <ThumbsDown className="w-4.5 h-4.5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.rejected}</p>
              <p className="text-xs text-muted-foreground">Ditolak</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari judul, nama pengaju, atau perusahaan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Diajukan</SelectItem>
            <SelectItem value="reviewed">Direview</SelectItem>
            <SelectItem value="approved">Disetujui</SelectItem>
            <SelectItem value="rejected">Ditolak</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="default" className="gap-2 shrink-0" onClick={handleExportExcel}>
          <Download className="w-4 h-4" /> Export Excel
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Tidak ada proposal yang cocok dengan filter.</p>
        </Card>
      ) : (
      <div className="space-y-4">
        {filtered.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex flex-col sm:flex-row items-start justify-between gap-4 pt-6">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-semibold truncate cursor-pointer hover:text-accent transition-colors" onClick={() => navigate(`/inovasi/proposal/${p.id}`)}>{p.title}</h3>
                  <Badge className={statusColors[p.status] || ""}>{statusLabels[p.status] || p.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <User className="w-3 h-3" />
                  <span className="font-medium">{p.submitter_name}</span>
                  {p.submitter_company && <span>— {p.submitter_company}</span>}
                </div>
                {p.innovation_categories && (
                  <p className="text-xs text-muted-foreground mt-1">Kategori: {p.innovation_categories.name}</p>
                )}
                {p.scope && <p className="text-xs text-muted-foreground">Lingkup: {p.scope}</p>}
                {p.expected_impact && <p className="text-xs text-muted-foreground">Dampak: {p.expected_impact}</p>}
                {p.admin_notes && (
                  <p className="text-xs mt-2 p-2 rounded bg-muted">Catatan: {p.admin_notes}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(p.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" className="gap-1" onClick={() => openReview(p.id, "reviewed")}>
                  <Eye className="w-3.5 h-3.5" /> Review
                </Button>
                <Button variant="outline" size="sm" className="gap-1 text-pub-emerald hover:text-pub-emerald" onClick={() => openReview(p.id, "approved")}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Setujui
                </Button>
                <Button variant="outline" size="sm" className="gap-1 text-destructive hover:text-destructive" onClick={() => openReview(p.id, "rejected")}>
                  <XCircle className="w-3.5 h-3.5" /> Tolak
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      )}

      <Dialog open={!!selectedId} onOpenChange={(open) => { if (!open) { setSelectedId(null); setAction(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {action === "approved" ? "Setujui Proposal" : action === "rejected" ? "Tolak Proposal" : "Review Proposal"}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div>
                <p className="font-semibold">{selected.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{selected.description}</p>
                {selected.scope && <p className="text-sm text-muted-foreground mt-1">Lingkup: {selected.scope}</p>}
                {selected.expected_impact && <p className="text-sm text-muted-foreground mt-1">Dampak: {selected.expected_impact}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Catatan Admin</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tambahkan catatan untuk user..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedId(null)}>Batal</Button>
                <Button
                  onClick={handleSubmit}
                  disabled={updateStatus.isPending}
                  className="gap-2"
                >
                  <Send className="w-4 h-4" />
                  {updateStatus.isPending ? "Menyimpan..." : action === "approved" ? "Setujui" : action === "rejected" ? "Tolak" : "Simpan Review"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

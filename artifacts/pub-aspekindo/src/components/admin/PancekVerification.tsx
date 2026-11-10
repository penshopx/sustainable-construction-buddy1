import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/sonner-toast";
import { motion } from "framer-motion";
import {
  ShieldAlert, CheckCircle2, XCircle, Clock, Eye, Send,
  ChevronDown, ChevronUp, Search, FileText, ExternalLink, AlertTriangle, ShieldCheck, CalendarDays,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { PANCEK_PILLARS } from "@/lib/pancekIndicators";
import type { Json, Tables } from "@/integrations/supabase/types";

interface PancekRow extends Tables<"pancek_assessments"> {
  full_name?: string;
}

interface VerificationDocument {
  name: string;
  url: string;
  uploaded_at: string;
}

interface VerificationSheet {
  docs: VerificationDocument[];
  verification_date?: string;
  notes?: string;
}

interface IndicatorAnswer {
  status?: string;
  score?: number;
  notes?: string;
  evidence_url?: string;
  evidence_name?: string;
  evidence_files?: { url: string; name: string }[];
}

const isVerificationSheet = (value: Json | undefined): value is Json & VerificationSheet => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, Json | undefined>;
  return Array.isArray(candidate.docs) && candidate.docs.every((doc) => {
    if (typeof doc !== "object" || doc === null || Array.isArray(doc)) return false;
    const document = doc as Record<string, Json | undefined>;
    return typeof document.name === "string" && typeof document.url === "string" && typeof document.uploaded_at === "string";
  });
};

export function PancekVerification() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<PancekRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("submitted");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRow, setSelectedRow] = useState<PancekRow | null>(null);
  const [verifyNotes, setVerifyNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    // Fetch all pancek assessments (admin can see all via RLS)
    const { data: assessments, error } = await supabase.from("pancek_assessments")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching pancek assessments:", error);
      setLoading(false);
      return;
    }

    // Fetch profiles for names
    const userIds = [...new Set((assessments || []).map((a) => a.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, company");

    const nameMap = new Map<string, string>();
    (profiles || []).forEach((p) => nameMap.set(p.user_id, p.full_name || "-"));

    const mapped: PancekRow[] = (assessments || []).map((a) => ({
      ...a,
      full_name: nameMap.get(a.user_id) || "-",
    }));

    setRows(mapped);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleVerify = async (action: "verified" | "rejected") => {
    if (!selectedRow || !profile) return;
    setProcessing(true);

    const { error } = await supabase.from("pancek_assessments")
      .update({
        status: action,
        verified_by: profile.full_name || "Admin",
        verified_at: new Date().toISOString(),
        verification_notes: verifyNotes,
      })
      .eq("id", selectedRow.id);

    if (error) {
      toast.error("Gagal memverifikasi: " + error.message);
    } else {
      toast.success(
        action === "verified"
          ? "PANCEK berhasil diverifikasi ✅"
          : "PANCEK ditolak — BUJK akan diberitahu"
      );
      // Send notification to user
      await supabase.from("notifications").insert({
        user_id: selectedRow.user_id,
        type: action === "verified" ? "pancek_verified" : "pancek_rejected",
        title: action === "verified"
          ? "PANCEK Terverifikasi ✅"
          : "PANCEK Ditolak ❌",
        message: action === "verified"
          ? `PANCEK periode ${selectedRow.period_year} telah diverifikasi oleh Asosiasi.${verifyNotes ? " Catatan: " + verifyNotes : ""}`
          : `PANCEK periode ${selectedRow.period_year} ditolak oleh Asosiasi. ${verifyNotes || "Silakan perbaiki dan submit ulang."}`,
      });

      setSelectedRow(null);
      setVerifyNotes("");
      fetchAll();
    }
    setProcessing(false);
  };

  const filtered = rows.filter((r) => {
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || r.company_name.toLowerCase().includes(q) || (r.full_name || "").toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const pillarScores = selectedRow ? [
    { label: "Komitmen", icon: "🤝", score: selectedRow.komitmen_score, total: selectedRow.komitmen_total },
    { label: "Perencanaan", icon: "📋", score: selectedRow.perencanaan_score, total: selectedRow.perencanaan_total },
    { label: "Pelaksanaan", icon: "⚙️", score: selectedRow.pelaksanaan_score, total: selectedRow.pelaksanaan_total },
    { label: "Evaluasi", icon: "📊", score: selectedRow.evaluasi_score, total: selectedRow.evaluasi_total },
    { label: "Perbaikan", icon: "🔧", score: selectedRow.perbaikan_score, total: selectedRow.perbaikan_total },
    { label: "Respon", icon: "🚨", score: selectedRow.respon_score, total: selectedRow.respon_total },
  ] : [];

  const statusBadge = (status: string) => {
    switch (status) {
      case "submitted": return <Badge className="bg-pub-sky/20 text-pub-sky border-pub-sky/30"><Clock className="w-3 h-3 mr-1" />Menunggu</Badge>;
      case "verified": return <Badge className="bg-pub-emerald/20 text-pub-emerald border-pub-emerald/30"><CheckCircle2 className="w-3 h-3 mr-1" />Verified</Badge>;
      case "rejected": return <Badge className="bg-destructive/20 text-destructive border-destructive/30"><XCircle className="w-3 h-3 mr-1" />Ditolak</Badge>;
      default: return <Badge variant="outline">Draft</Badge>;
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Memuat data PANCEK...</div>;
  }

  const submittedCount = rows.filter(r => r.status === "submitted").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl border border-border p-6 shadow-card space-y-4"
    >
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold font-heading text-foreground flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-pub-amber" />
            Verifikasi PANCEK KPK
            {submittedCount > 0 && (
              <Badge className="bg-pub-amber/20 text-pub-amber border-pub-amber/30 ml-2">
                {submittedCount} pending
              </Badge>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            Approve atau reject submission PANCEK dari BUJK anggota
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari perusahaan atau nama..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="submitted">Menunggu Verifikasi</SelectItem>
            <SelectItem value="verified">Terverifikasi</SelectItem>
            <SelectItem value="rejected">Ditolak</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="all">Semua Status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-heading">Badan Usaha</TableHead>
                <TableHead className="font-heading">Nama</TableHead>
                <TableHead className="font-heading text-center">Periode</TableHead>
                <TableHead className="font-heading text-center">Progres</TableHead>
                <TableHead className="font-heading text-center">Status</TableHead>
                <TableHead className="font-heading text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/20">
                  <TableCell className="font-medium text-foreground">{row.company_name || "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.full_name}</TableCell>
                  <TableCell className="text-center text-sm">{row.period_year}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center gap-2 justify-center">
                      <Progress value={row.completion_percent} className="h-2 w-16" />
                      <span className="text-xs text-muted-foreground">{row.total_answered}/{row.total_indicators}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{statusBadge(row.status)}</TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => { setSelectedRow(row); setVerifyNotes(""); }}
                    >
                      <Eye className="w-3 h-3" />
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">
          Tidak ada submission PANCEK dengan status yang dipilih.
        </p>
      )}

      {/* Review Dialog */}
      <Dialog open={!!selectedRow} onOpenChange={(open) => !open && setSelectedRow(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading">
              <ShieldAlert className="w-5 h-5 text-pub-amber" />
              Review PANCEK — {selectedRow?.company_name}
            </DialogTitle>
            <DialogDescription>
              Periode {selectedRow?.period_year} • Diajukan oleh {selectedRow?.full_name}
            </DialogDescription>
          </DialogHeader>

          {selectedRow && (
            <div className="space-y-4">
              {/* Company Info */}
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">NPWP</p>
                  <p className="font-medium">{selectedRow.npwp || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">NIB</p>
                  <p className="font-medium">{selectedRow.nib || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Progres</p>
                  <p className="font-medium font-heading">{selectedRow.total_answered}/{selectedRow.total_indicators} ({selectedRow.completion_percent}%)</p>
                </div>
              </div>

              {/* Pillar Scores */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {pillarScores.map((p) => {
                  const pct = p.total > 0 ? Math.round((p.score / p.total) * 100) : 0;
                  return (
                    <div key={p.label} className="text-center p-2 rounded-lg bg-muted/30 border border-border">
                      <div className="text-lg">{p.icon}</div>
                      <p className="text-[10px] text-muted-foreground font-heading truncate">{p.label}</p>
                      <p className={`text-sm font-bold font-heading ${pct >= 80 ? "text-pub-emerald" : pct >= 50 ? "text-pub-amber" : "text-destructive"}`}>
                        {p.score}/{p.total}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Indicator Details (collapsible per pillar) */}
              <div className="space-y-2">
                <p className="text-sm font-heading font-semibold">Detail Indikator & Bukti Dokumen</p>
                {PANCEK_PILLARS.map((pillar) => {
                  const answers: Record<string, boolean | IndicatorAnswer | undefined> =
                    selectedRow.answers && typeof selectedRow.answers === "object" && !Array.isArray(selectedRow.answers)
                      ? selectedRow.answers as Record<string, boolean | IndicatorAnswer | undefined>
                      : {};
                  const answered = pillar.indicators.filter(ind => {
                    const a = answers[ind.code];
                    if (typeof a === "boolean") return a;
                    return a?.status === "ya" || a?.status === "sebagian";
                  }).length;
                  return (
                    <details key={pillar.id} className="group border border-border rounded-lg">
                      <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/20">
                        <div className="flex items-center gap-2 text-sm">
                          <span>{pillar.icon}</span>
                          <span className="font-heading font-medium">{pillar.label}</span>
                          <Badge className="text-[9px] px-1.5 py-0 bg-muted text-muted-foreground">{pillar.weight}%</Badge>
                          <Badge variant="outline" className="text-[10px] px-1 py-0">{answered}/{pillar.indicators.length}</Badge>
                        </div>
                        <ChevronDown className="w-4 h-4 text-muted-foreground group-open:hidden" />
                        <ChevronUp className="w-4 h-4 text-muted-foreground hidden group-open:block" />
                      </summary>
                      <div className="px-3 pb-3 space-y-1.5">
                        {pillar.indicators.map((ind) => {
                          const raw = answers[ind.code];
                          // Support both legacy boolean and new object format
                          const isLegacy = typeof raw === "boolean";
                          const status = isLegacy ? (raw ? "ya" : "") : raw?.status || "";
                          const score = isLegacy ? (raw ? 4 : 0) : raw?.score || 0;
                          const notes = isLegacy ? "" : raw?.notes || "";
                          const evidenceUrl = isLegacy ? "" : raw?.evidence_url || "";
                          const evidenceName = isLegacy ? "" : raw?.evidence_name || "";
                          // Support multiple files
                          const evidenceFiles: { url: string; name: string }[] = [];
                          if (raw && !isLegacy && raw.evidence_files?.length) {
                            evidenceFiles.push(...raw.evidence_files);
                          } else if (evidenceUrl) {
                            evidenceFiles.push({ url: evidenceUrl, name: evidenceName || "Dokumen" });
                          }

                          const statusIcon = status === "ya"
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-pub-emerald shrink-0" />
                            : status === "sebagian"
                            ? <AlertTriangle className="w-3.5 h-3.5 text-pub-amber shrink-0" />
                            : status === "tidak"
                            ? <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                            : <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 shrink-0" />;

                          const bgColor = status === "ya"
                            ? "bg-pub-emerald/5 border-pub-emerald/15"
                            : status === "sebagian"
                            ? "bg-pub-amber/5 border-pub-amber/15"
                            : status === "tidak"
                            ? "bg-destructive/5 border-destructive/15"
                            : "bg-muted/20 border-border";

                          return (
                            <div key={ind.code} className={`rounded-lg border p-2.5 ${bgColor}`}>
                              <div className="flex items-start gap-2">
                                {statusIcon}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-heading font-bold text-pub-amber text-xs">{ind.code}</span>
                                    <span className="text-xs text-foreground">{ind.text}</span>
                                    {score > 0 && (
                                      <Badge variant="outline" className="text-[9px] px-1 py-0">{score}/4</Badge>
                                    )}
                                  </div>
                                  {notes && (
                                    <p className="text-[11px] text-muted-foreground mt-1 italic">📝 {notes}</p>
                                  )}
                                  {evidenceFiles.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                      {evidenceFiles.map((ef, idx) => (
                                        <Button
                                          key={ef.url}
                                          variant="link"
                                          size="sm"
                                          className="h-auto p-0 text-[11px] text-pub-sky gap-1"
                                          onClick={async () => {
                                            const { data } = await supabase.storage
                                              .from("pancek-evidence")
                                              .createSignedUrl(ef.url, 3600);
                                            if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                                            else toast.error("Gagal membuka file bukti");
                                          }}
                                        >
                                          <FileText className="w-3 h-3" />
                                          {evidenceFiles.length > 1 ? `${idx + 1}. ${ef.name}` : (ef.name || "Lihat Bukti")}
                                          <ExternalLink className="w-2.5 h-2.5" />
                                        </Button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  );
                })}
              </div>

              {/* Lembar Verifikasi Jaga.id */}
              {(() => {
                const answers = selectedRow.answers;
                const lv = answers && typeof answers === "object" && !Array.isArray(answers)
                  ? answers.__lembar_verifikasi
                  : undefined;
                if (!isVerificationSheet(lv) || !lv.docs.length) return (
                  <div className="p-3 rounded-lg border border-border bg-muted/20">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ShieldCheck className="w-4 h-4" />
                      <span className="font-heading font-medium">Lembar Verifikasi Jaga.id</span>
                    </div>
                    <p className="text-xs text-muted-foreground/70 mt-1">BUJK belum mengupload lembar verifikasi dari Jaga.id</p>
                  </div>
                );
                return (
                  <div className="p-3 rounded-lg border border-pub-sky/30 bg-pub-sky/5 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <ShieldCheck className="w-4 h-4 text-pub-sky" />
                      <span className="font-heading font-medium text-foreground">Lembar Verifikasi Jaga.id</span>
                      <Badge className="bg-pub-sky/20 text-pub-sky border-pub-sky/30 text-[10px]">
                        {lv.docs.length} dokumen
                      </Badge>
                    </div>
                    {lv.verification_date && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        Tanggal verifikasi: {new Date(lv.verification_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    )}
                    {lv.notes && (
                      <p className="text-xs text-muted-foreground italic">📝 {lv.notes}</p>
                    )}
                    <div className="space-y-1">
                      {lv.docs.map((doc, idx) => (
                        <div key={doc.url} className="flex items-center gap-2 p-2 rounded bg-background/50 border border-border">
                          <FileText className="w-3.5 h-3.5 text-pub-sky shrink-0" />
                          <span className="text-xs text-foreground truncate flex-1">{idx + 1}. {doc.name}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {new Date(doc.uploaded_at).toLocaleDateString("id-ID")}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-pub-sky text-[10px] gap-1"
                            onClick={async () => {
                              const { data } = await supabase.storage
                                .from("pancek-evidence")
                                .createSignedUrl(doc.url, 3600);
                              if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                              else toast.error("Gagal membuka file");
                            }}
                          >
                            <ExternalLink className="w-3 h-3" />Lihat
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Previous verification info */}
              {(selectedRow.status === "verified" || selectedRow.status === "rejected") && (
                <div className={`p-3 rounded-lg border ${selectedRow.status === "verified" ? "border-pub-emerald/30 bg-pub-emerald/5" : "border-destructive/30 bg-destructive/5"}`}>
                  <p className="text-xs text-muted-foreground">
                    {selectedRow.status === "verified" ? "Diverifikasi" : "Ditolak"} oleh {selectedRow.verified_by}
                    {selectedRow.verified_at && ` pada ${new Date(selectedRow.verified_at).toLocaleDateString("id-ID")}`}
                  </p>
                  {selectedRow.verification_notes && (
                    <p className="text-sm mt-1">{selectedRow.verification_notes}</p>
                  )}
                </div>
              )}

              {/* Verification Notes */}
              {selectedRow.status === "submitted" && (
                <div>
                  <label className="text-sm font-heading font-medium">Catatan Verifikasi</label>
                  <Textarea
                    value={verifyNotes}
                    onChange={(e) => setVerifyNotes(e.target.value)}
                    placeholder="Tambahkan catatan untuk BUJK (opsional)..."
                    className="mt-1"
                    rows={3}
                  />
                </div>
              )}
            </div>
          )}

          {selectedRow?.status === "submitted" && (
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={() => handleVerify("rejected")}
                disabled={processing}
              >
                <XCircle className="w-4 h-4" />
                Tolak
              </Button>
              <Button
                className="gap-2 bg-pub-emerald hover:bg-pub-emerald/90 text-white"
                onClick={() => handleVerify("verified")}
                disabled={processing}
              >
                <CheckCircle2 className="w-4 h-4" />
                Verifikasi
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

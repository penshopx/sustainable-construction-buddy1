import { useState, useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { IndicatorAnswer, IndicatorStatus, EvidenceFile } from "@/lib/pancekAnswerTypes";
import type { PancekIndicator } from "@/lib/pancekIndicators";
import {
  CheckCircle2, XCircle, AlertTriangle, Upload, FileText, Trash2, Loader2,
  ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react";
import { toast } from "@/components/ui/sonner-toast";

interface IndicatorFormItemProps {
  indicator: PancekIndicator;
  answer: IndicatorAnswer;
  onChange: (code: string, answer: IndicatorAnswer) => void;
  disabled?: boolean;
  index: number;
  isTrial?: boolean;
}

const STATUS_OPTIONS: { value: IndicatorStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "ya", label: "Ya / Terpenuhi", icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-pub-emerald" },
  { value: "sebagian", label: "Sebagian", icon: <AlertTriangle className="w-3.5 h-3.5" />, color: "text-pub-amber" },
  { value: "tidak", label: "Tidak", icon: <XCircle className="w-3.5 h-3.5" />, color: "text-destructive" },
];

const SCORE_LABELS = ["0 — Tidak ada", "1 — Minimal", "2 — Sebagian", "3 — Hampir penuh", "4 — Sepenuhnya"];

/** Merge legacy single evidence into evidence_files array */
function getEvidenceFiles(answer: IndicatorAnswer): EvidenceFile[] {
  const files: EvidenceFile[] = [...(answer.evidence_files || [])];
  // Migrate legacy single file if not already in the list
  if (answer.evidence_url && !files.some(f => f.url === answer.evidence_url)) {
    files.unshift({ url: answer.evidence_url, name: answer.evidence_name || "Dokumen" });
  }
  return files;
}

export default function IndicatorFormItem({ indicator, answer, onChange, disabled, index, isTrial }: IndicatorFormItemProps) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const evidenceFiles = getEvidenceFiles(answer);

  const statusColor = answer.status === "ya"
    ? "bg-pub-emerald/5 border-pub-emerald/20"
    : answer.status === "sebagian"
    ? "bg-pub-amber/5 border-pub-amber/20"
    : answer.status === "tidak"
    ? "bg-destructive/5 border-destructive/20"
    : "bg-muted/20 border-border";

  const handleStatusChange = (val: string) => {
    const status = val as IndicatorStatus;
    const autoScore = status === "ya" ? 4 : status === "sebagian" ? 2 : status === "tidak" ? 0 : answer.score;
    onChange(indicator.code, { ...answer, status, score: autoScore });
  };

  const handleScoreChange = (val: number[]) => {
    onChange(indicator.code, { ...answer, score: val[0] });
  };

  const handleNotesChange = (val: string) => {
    onChange(indicator.code, { ...answer, notes: val });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 10MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${indicator.code.replace(/\./g, "_")}_${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from("pancek-evidence")
        .upload(path, file, { upsert: true });

      if (error) throw error;

      const newFile: EvidenceFile = { url: path, name: file.name };
      const updatedFiles = [...evidenceFiles, newFile];

      onChange(indicator.code, {
        ...answer,
        // Keep legacy field pointing to first file for backward compat
        evidence_url: updatedFiles[0]?.url,
        evidence_name: updatedFiles[0]?.name,
        evidence_files: updatedFiles,
      });
      toast.success(`Bukti "${file.name}" berhasil diupload`);
    } catch (err: unknown) {
      toast.error(`Gagal upload: ${err instanceof Error ? err.message : "terjadi kesalahan"}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDeleteEvidence = async (fileToDelete: EvidenceFile) => {
    try {
      await supabase.storage.from("pancek-evidence").remove([fileToDelete.url]);
      const updatedFiles = evidenceFiles.filter(f => f.url !== fileToDelete.url);
      onChange(indicator.code, {
        ...answer,
        evidence_url: updatedFiles[0]?.url,
        evidence_name: updatedFiles[0]?.name,
        evidence_files: updatedFiles.length > 0 ? updatedFiles : undefined,
      });
      toast.success("Bukti dihapus");
    } catch {
      toast.error("Gagal menghapus bukti");
    }
  };

  const handleViewFile = async (fileUrl: string) => {
    const { data } = await supabase.storage
      .from("pancek-evidence")
      .createSignedUrl(fileUrl, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Gagal membuka file");
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.015 }}
      className={`rounded-lg border transition-colors ${statusColor}`}
    >
      {/* Header Row */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="shrink-0">
          {answer.status === "ya" ? (
            <CheckCircle2 className="w-5 h-5 text-pub-emerald" />
          ) : answer.status === "sebagian" ? (
            <AlertTriangle className="w-5 h-5 text-pub-amber" />
          ) : answer.status === "tidak" ? (
            <XCircle className="w-5 h-5 text-destructive" />
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <span className="text-xs font-heading font-bold text-pub-amber mr-2">{indicator.code}</span>
          <span className="text-sm text-foreground">{indicator.text}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {answer.score > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{answer.score}/4</Badge>
          )}
          {evidenceFiles.length > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-pub-sky">
              <FileText className="w-2.5 h-2.5 mr-0.5" />📎{evidenceFiles.length > 1 ? ` ${evidenceFiles.length}` : ""}
            </Badge>
          )}
          {answer.notes && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">💬</Badge>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded Form */}
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="px-3 pb-3 space-y-3 border-t border-border/50 pt-3"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-heading text-muted-foreground mb-1 block">Status Kepatuhan</label>
              <Select value={answer.status || ""} onValueChange={handleStatusChange} disabled={disabled}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Pilih status..." />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className={`flex items-center gap-2 ${opt.color}`}>
                        {opt.icon} {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-[11px] font-heading text-muted-foreground mb-1 block">
                Skor Penilaian: <strong className="text-foreground">{SCORE_LABELS[answer.score]}</strong>
              </label>
              <Slider
                value={[answer.score]}
                onValueChange={handleScoreChange}
                min={0}
                max={4}
                step={1}
                disabled={disabled}
                className="mt-2"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[11px] font-heading text-muted-foreground mb-1 block">Catatan / Keterangan</label>
            <Textarea
              value={answer.notes}
              onChange={e => handleNotesChange(e.target.value)}
              disabled={disabled}
              placeholder="Tuliskan keterangan, penjelasan, atau temuan..."
              className="text-sm min-h-[60px] resize-none"
            />
          </div>

          {/* Evidence Upload - Multiple Files */}
          <div>
            <label className="text-[11px] font-heading text-muted-foreground mb-1 block">
              Bukti Dokumen {evidenceFiles.length > 0 && `(${evidenceFiles.length} file)`}
            </label>

            {/* List of uploaded files */}
            {evidenceFiles.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {evidenceFiles.map((file, i) => (
                  <div key={file.url} className="flex items-center gap-2 p-2 rounded bg-muted/30 border border-border">
                    <FileText className="w-4 h-4 text-pub-sky shrink-0" />
                    <span className="text-xs text-foreground truncate flex-1">
                      {i + 1}. {file.name || "Dokumen terupload"}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-pub-sky text-[10px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewFile(file.url);
                      }}
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />Lihat
                    </Button>
                    {!disabled && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteEvidence(file)}
                        className="h-6 w-6 p-0 text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Upload button (always shown when not disabled) */}
            {!disabled && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="gap-2 text-xs"
                >
                  {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  {uploading ? "Mengupload..." : evidenceFiles.length > 0 ? "Tambah Bukti Lain" : "Upload Bukti"}
                </Button>
                <p className="text-[10px] text-muted-foreground mt-1">PDF, JPG, PNG, DOC, XLS — Maks. 10MB per file</p>
              </>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

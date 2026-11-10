import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import {
  Upload, FileText, Trash2, Loader2, ExternalLink, ShieldCheck, CalendarDays, Download,
} from "lucide-react";
import { exportLembarVerifikasiPdf } from "@/lib/lembarVerifikasiPdf";
import type { PancekAssessment } from "@/hooks/usePancekAssessment";
import { toast } from "@/components/ui/sonner-toast";
import type { Json } from "@/integrations/supabase/types";

interface VerificationDoc {
  url: string;
  name: string;
  uploaded_at: string;
}

interface LembarVerifikasiData {
  docs: VerificationDoc[];
  verification_date?: string;
  notes?: string;
}

const parseVerificationData = (value: Json): LembarVerifikasiData | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, Json | undefined>;
  if (!Array.isArray(record.docs)) return null;
  const docs = record.docs.flatMap((doc) => {
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) return [];
    const item = doc as Record<string, Json | undefined>;
    return typeof item.url === "string" && typeof item.name === "string" && typeof item.uploaded_at === "string"
      ? [{ url: item.url, name: item.name, uploaded_at: item.uploaded_at }]
      : [];
  });
  return {
    docs,
    ...(typeof record.verification_date === "string" ? { verification_date: record.verification_date } : {}),
    ...(typeof record.notes === "string" ? { notes: record.notes } : {}),
  };
};

const verificationDataToJson = (data: LembarVerifikasiData): Json => ({
  docs: data.docs.map(({ url, name, uploaded_at }) => ({ url, name, uploaded_at })),
  ...(data.verification_date !== undefined ? { verification_date: data.verification_date } : {}),
  ...(data.notes !== undefined ? { notes: data.notes } : {}),
});

const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Terjadi kesalahan.";

interface Props {
  assessmentId?: string;
  periodYear: number;
  assessment?: PancekAssessment;
}

export default function LembarVerifikasi({ assessmentId, periodYear, assessment }: Props) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [data, setData] = useState<LembarVerifikasiData>({ docs: [] });
  const [loaded, setLoaded] = useState(false);

  // Load existing data from the assessment's answers JSON (lembar_verifikasi key)
  const loadData = async () => {
    if (!assessmentId || loaded) return;
    try {
      const { data: row } = await supabase.from("pancek_assessments")
        .select("answers")
        .eq("id", assessmentId)
        .single();
      const verification = row ? parseVerificationData(row.answers) : null;
      if (verification) setData(verification);
      setLoaded(true);
    } catch {
      setLoaded(true);
    }
  };

  // Load on mount
  if (!loaded && assessmentId) loadData();

  const saveData = async (newData: LembarVerifikasiData) => {
    if (!assessmentId) {
      toast.error("Simpan assessment terlebih dahulu sebelum upload lembar verifikasi");
      return;
    }
    try {
      // Fetch current answers
      const { data: row } = await supabase.from("pancek_assessments")
        .select("answers")
        .eq("id", assessmentId)
        .single();

      const currentAnswers = row?.answers && typeof row.answers === "object" && !Array.isArray(row.answers)
        ? row.answers
        : {};
      const updatedAnswers: Json = {
        ...currentAnswers,
        __lembar_verifikasi: verificationDataToJson(newData),
      };

      const { error } = await supabase.from("pancek_assessments")
        .update({ answers: updatedAnswers })
        .eq("id", assessmentId);

      if (error) throw error;
      setData(newData);
    } catch (error: unknown) {
      toast.error("Gagal menyimpan: " + errorMessage(error));
    }
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
      const path = `${user.id}/lembar_verifikasi_${periodYear}_${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from("pancek-evidence")
        .upload(path, file, { upsert: true });

      if (error) throw error;

      const newDoc: VerificationDoc = {
        url: path,
        name: file.name,
        uploaded_at: new Date().toISOString(),
      };
      const newData = { ...data, docs: [...data.docs, newDoc] };
      await saveData(newData);
      toast.success(`"${file.name}" berhasil diupload`);
    } catch (error: unknown) {
      toast.error("Gagal upload: " + errorMessage(error));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (doc: VerificationDoc) => {
    try {
      await supabase.storage.from("pancek-evidence").remove([doc.url]);
      const newData = { ...data, docs: data.docs.filter(d => d.url !== doc.url) };
      await saveData(newData);
      toast.success("Dokumen dihapus");
    } catch {
      toast.error("Gagal menghapus dokumen");
    }
  };

  const handleView = async (url: string) => {
    const { data: signedData } = await supabase.storage
      .from("pancek-evidence")
      .createSignedUrl(url, 3600);
    if (signedData?.signedUrl) window.open(signedData.signedUrl, "_blank");
    else toast.error("Gagal membuka file");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Export Button */}
      {assessment && (
        <Card className="border-pub-emerald/30 bg-pub-emerald/5">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-pub-emerald shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Cetak Lembar Verifikasi Resmi</p>
                <p className="text-xs text-muted-foreground">Download dokumen lampiran resmi untuk perpanjangan SBU</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-pub-emerald/30 text-pub-emerald hover:bg-pub-emerald/10 shrink-0"
              onClick={() => exportLembarVerifikasiPdf(assessment)}
            >
              <Download className="w-4 h-4" />
              Export PDF
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Info Banner */}
      <Card className="border-pub-sky/30 bg-pub-sky/5">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-pub-sky mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Lembar Verifikasi Jaga.id</p>
              <p className="text-xs text-muted-foreground mt-1">
                Upload dokumen hasil konfirmasi penilaian PANCEK dari platform Jaga.id. 
                Dokumen ini menjadi bukti bahwa penilaian telah diverifikasi secara resmi oleh KPK.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-background/60 border border-pub-sky/20">
            <ExternalLink className="w-4 h-4 text-pub-sky shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-heading font-medium text-foreground">Akses Platform Jaga.id</p>
              <p className="text-[10px] text-muted-foreground">Buka platform resmi KPK untuk melakukan penilaian dan mendapatkan lembar verifikasi</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs border-pub-sky/30 text-pub-sky hover:bg-pub-sky/10 shrink-0"
              onClick={() => window.open("https://jaga.id", "_blank")}
            >
              <ExternalLink className="w-3 h-3" />
              Buka Jaga.id
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <FileText className="w-5 h-5 text-pub-amber" />
            Dokumen Lembar Verifikasi — Periode {periodYear}
          </CardTitle>
          <CardDescription>
            Upload file PDF atau gambar lembar verifikasi dari Jaga.id
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Verification Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarDays className="w-3 h-3" /> Tanggal Verifikasi Jaga.id
              </Label>
              <Input
                type="date"
                value={data.verification_date || ""}
                onChange={e => {
                  const newData = { ...data, verification_date: e.target.value };
                  saveData(newData);
                }}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Catatan</Label>
              <Textarea
                value={data.notes || ""}
                onChange={e => {
                  const newData = { ...data, notes: e.target.value };
                  setData(newData);
                }}
                onBlur={() => saveData(data)}
                placeholder="Catatan tambahan tentang verifikasi..."
                className="mt-1 text-sm min-h-[60px] resize-none"
              />
            </div>
          </div>

          {/* Uploaded Documents List */}
          {data.docs.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-heading text-muted-foreground">Dokumen Terupload ({data.docs.length})</p>
              {data.docs.map((doc, i) => (
                <div key={doc.url} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border border-border">
                  <FileText className="w-4 h-4 text-pub-sky shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{i + 1}. {doc.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Diupload {new Date(doc.uploaded_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-pub-sky text-xs gap-1"
                    onClick={() => handleView(doc.url)}
                  >
                    <ExternalLink className="w-3 h-3" />Lihat
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(doc)}
                    className="h-7 w-7 p-0 text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Upload Button */}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || !assessmentId}
              className="gap-2"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Mengupload..." : data.docs.length > 0 ? "Tambah Dokumen Lain" : "Upload Lembar Verifikasi"}
            </Button>
            {!assessmentId && (
              <p className="text-xs text-destructive mt-1">⚠️ Simpan assessment di tab Form Resmi terlebih dahulu</p>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">PDF, JPG, PNG, DOC — Maks. 10MB per file</p>
          </div>

          {/* Empty state */}
          {data.docs.length === 0 && (
            <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
              <ShieldCheck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Belum ada lembar verifikasi</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Upload dokumen hasil verifikasi dari platform Jaga.id
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

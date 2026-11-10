import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useSmapDocuments, type SmapDocument } from "@/hooks/useSmapDocuments";
import { useAuth } from "@/hooks/useAuth";
import { GraduationCap, Plus, Save, Trash2, Users, Clock as ClockIcon } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "@/components/ui/sonner-toast";

export default function PendidikanAntikorupsiTab() {
  const { profile } = useAuth();
  const { documents, loading, saveDocument, deleteDocument, uploadFile } = useSmapDocuments("pendidikan_antikorupsi");
  const [editing, setEditing] = useState<Partial<SmapDocument> | null>(null);
  const [uploading, setUploading] = useState(false);

  const totalHours = documents.reduce((sum, d) => sum + (d.training_hours || 0), 0);
  const totalParticipants = documents.reduce((sum, d) => sum + (d.participant_count || 0), 0);

  const handleNew = () => {
    setEditing({
      doc_type: "pendidikan_antikorupsi",
      company_name: profile?.company || "",
      training_provider: "KPK",
      status: "draft",
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.training_name) {
      toast.error("Nama pelatihan wajib diisi");
      return;
    }
    await saveDocument({ ...editing, doc_type: "pendidikan_antikorupsi" });
    setEditing(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing?.id) return;
    setUploading(true);
    const result = await uploadFile(file, editing.id);
    if (result) {
      setEditing(prev => prev ? { ...prev, file_url: result.url, file_name: result.name } : null);
      await saveDocument({ id: editing.id, doc_type: "pendidikan_antikorupsi", file_url: result.url, file_name: result.name });
    }
    setUploading(false);
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Memuat...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-heading font-semibold">Pendidikan Anti Korupsi</h3>
          <p className="text-xs text-muted-foreground">Pelatihan antikorupsi dari KPK — catat sertifikat dan jam pelatihan personil</p>
        </div>
        {!editing && (
          <Button size="sm" onClick={handleNew} className="gap-2">
            <Plus className="w-4 h-4" /> Tambah Pelatihan
          </Button>
        )}
      </div>

      {/* Summary */}
      {documents.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Pelatihan</p>
              <p className="text-2xl font-bold font-heading text-primary">{documents.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-pub-amber/5 border-pub-amber/20">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Jam</p>
              <p className="text-2xl font-bold font-heading text-pub-amber">{totalHours}</p>
            </CardContent>
          </Card>
          <Card className="bg-pub-emerald/5 border-pub-emerald/20">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Peserta</p>
              <p className="text-2xl font-bold font-heading text-pub-emerald">{totalParticipants}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {editing && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-2 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Form Pelatihan Anti Korupsi</CardTitle>
              <CardDescription>Catat pelatihan antikorupsi yang diikuti oleh personil perusahaan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Nama Pelatihan *</Label>
                  <Input value={editing.training_name || ""} onChange={e => setEditing(p => p ? { ...p, training_name: e.target.value } : null)} className="mt-1" placeholder="Cth: Pelatihan Antikorupsi KPK Batch 5" />
                </div>
                <div>
                  <Label className="text-xs">Penyelenggara</Label>
                  <Input value={editing.training_provider || ""} onChange={e => setEditing(p => p ? { ...p, training_provider: e.target.value } : null)} className="mt-1" placeholder="KPK / Lembaga lainnya" />
                </div>
                <div>
                  <Label className="text-xs">Nomor Sertifikat</Label>
                  <Input value={editing.document_number || ""} onChange={e => setEditing(p => p ? { ...p, document_number: e.target.value } : null)} className="mt-1" placeholder="Contoh: SERT-KPK/2024/00567" />
                </div>
                <div>
                  <Label className="text-xs">Tanggal Pelaksanaan</Label>
                  <Input type="date" value={editing.issued_date || ""} onChange={e => setEditing(p => p ? { ...p, issued_date: e.target.value } : null)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Jumlah Jam Pelatihan</Label>
                  <Input type="number" min={0} value={editing.training_hours || 0} onChange={e => setEditing(p => p ? { ...p, training_hours: Number(e.target.value) } : null)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Jumlah Peserta</Label>
                  <Input type="number" min={0} value={editing.participant_count || 0} onChange={e => setEditing(p => p ? { ...p, participant_count: Number(e.target.value) } : null)} className="mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Catatan</Label>
                <Textarea value={editing.notes || ""} onChange={e => setEditing(p => p ? { ...p, notes: e.target.value } : null)} className="mt-1" rows={2} placeholder="Contoh: Pelatihan diikuti oleh seluruh direksi dan manajer proyek. Materi mencakup gratifikasi, benturan kepentingan, dan whistleblowing system." />
              </div>
              {editing.id && (
                <div>
                  <Label className="text-xs">Upload Sertifikat (PDF/JPG)</Label>
                  <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} disabled={uploading} className="mt-1" />
                  {editing.file_name && <p className="text-xs text-muted-foreground mt-1">File: {editing.file_name}</p>}
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditing(null)}>Batal</Button>
                <Button onClick={handleSave} className="gap-2"><Save className="w-4 h-4" /> Simpan</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {documents.length === 0 && !editing && (
        <Card className="bg-muted/30">
          <CardContent className="p-8 text-center text-muted-foreground space-y-3">
            <GraduationCap className="w-10 h-10 mx-auto opacity-40" />
            <p className="text-sm font-semibold text-foreground">Belum ada data pelatihan antikorupsi</p>
            <p className="text-xs">Tambahkan sertifikat pelatihan dari KPK atau lembaga antikorupsi lainnya</p>
            <div className="text-left max-w-md mx-auto bg-muted/50 rounded-lg p-4 text-xs space-y-1.5">
              <p className="font-semibold text-foreground mb-2">🎓 Contoh pelatihan yang dapat dicatat:</p>
              <p>• E-Learning Anti Korupsi KPK (ACLC) — 4 jam</p>
              <p>• Workshop Gratifikasi & Benturan Kepentingan — 8 jam</p>
              <p>• Pelatihan Whistleblowing System — 4 jam</p>
              <p>• Sertifikasi SMAP ISO 37001 Awareness — 16 jam</p>
            </div>
          </CardContent>
        </Card>
      )}

      {documents.map((doc, i) => (
        <motion.div key={doc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
          <Card>
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <GraduationCap className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-medium text-sm truncate">{doc.training_name}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {doc.training_provider} • {doc.training_hours} jam • <Users className="w-3 h-3 inline" /> {doc.participant_count} peserta
                </p>
                {doc.document_number && <p className="text-xs text-muted-foreground">No. {doc.document_number}</p>}
                {doc.file_name && <p className="text-xs text-muted-foreground mt-0.5">📎 {doc.file_name}</p>}
              </div>
              <div className="flex gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => setEditing(doc)}>Edit</Button>
                {doc.status === "draft" && (
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteDocument(doc.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

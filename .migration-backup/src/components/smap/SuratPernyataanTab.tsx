import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useSmapDocuments, type SmapDocument } from "@/hooks/useSmapDocuments";
import { useAuth } from "@/hooks/useAuth";
import { FileText, Plus, Save, Trash2, Upload, CheckCircle2, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "@/components/ui/sonner-toast";

export default function SuratPernyataanTab() {
  const { profile } = useAuth();
  const { documents, loading, saveDocument, deleteDocument, uploadFile } = useSmapDocuments("surat_pernyataan");
  const [editing, setEditing] = useState<Partial<SmapDocument> | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleNew = () => {
    setEditing({
      doc_type: "surat_pernyataan",
      company_name: profile?.company || "",
      sbu_application_type: "baru",
      signatory_name: profile?.full_name || "",
      signatory_position: profile?.position || "",
      status: "draft",
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.company_name || !editing.signatory_name) {
      toast.error("Nama perusahaan dan penandatangan wajib diisi");
      return;
    }
    await saveDocument({ ...editing, doc_type: "surat_pernyataan" });
    setEditing(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing?.id) return;
    setUploading(true);
    const result = await uploadFile(file, editing.id);
    if (result) {
      setEditing(prev => prev ? { ...prev, file_url: result.url, file_name: result.name } : null);
      await saveDocument({ id: editing.id, doc_type: "surat_pernyataan", file_url: result.url, file_name: result.name });
    }
    setUploading(false);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "submitted": return <Badge className="bg-pub-sky/20 text-pub-sky border-pub-sky/30"><Clock className="w-3 h-3 mr-1" />Diajukan</Badge>;
      case "verified": return <Badge className="bg-pub-emerald/20 text-pub-emerald border-pub-emerald/30"><CheckCircle2 className="w-3 h-3 mr-1" />Terverifikasi</Badge>;
      default: return <Badge variant="outline"><FileText className="w-3 h-3 mr-1" />Draft</Badge>;
    }
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Memuat...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-heading font-semibold">Surat Pernyataan SMAP</h3>
          <p className="text-xs text-muted-foreground">Khusus untuk pengajuan SBU baru — sebagai pengganti sementara sertifikasi ISO 37001</p>
        </div>
        {!editing && (
          <Button size="sm" onClick={handleNew} className="gap-2">
            <Plus className="w-4 h-4" /> Buat Surat
          </Button>
        )}
      </div>

      {editing && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-2 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Form Surat Pernyataan</CardTitle>
              <CardDescription>Pernyataan komitmen penerapan Sistem Manajemen Anti Penyuapan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Nama Badan Usaha</Label>
                  <Input value={editing.company_name || ""} onChange={e => setEditing(p => p ? { ...p, company_name: e.target.value } : null)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Nomor Dokumen</Label>
                  <Input value={editing.document_number || ""} onChange={e => setEditing(p => p ? { ...p, document_number: e.target.value } : null)} className="mt-1" placeholder="Opsional" />
                </div>
                <div>
                  <Label className="text-xs">Nama Penandatangan</Label>
                  <Input value={editing.signatory_name || ""} onChange={e => setEditing(p => p ? { ...p, signatory_name: e.target.value } : null)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Jabatan Penandatangan</Label>
                  <Input value={editing.signatory_position || ""} onChange={e => setEditing(p => p ? { ...p, signatory_position: e.target.value } : null)} className="mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Catatan</Label>
                <Textarea value={editing.notes || ""} onChange={e => setEditing(p => p ? { ...p, notes: e.target.value } : null)} className="mt-1" rows={3} />
              </div>
              {editing.id && (
                <div>
                  <Label className="text-xs">Upload Surat (PDF/JPG)</Label>
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
            <FileText className="w-10 h-10 mx-auto opacity-40" />
            <p className="text-sm font-semibold text-foreground">Belum ada Surat Pernyataan</p>
            <p className="text-xs">Buat surat pernyataan komitmen SMAP untuk pengajuan SBU baru</p>
            <div className="text-left max-w-md mx-auto bg-muted/50 rounded-lg p-4 text-xs space-y-1.5">
              <p className="font-semibold text-foreground mb-2">📝 Isi surat pernyataan meliputi:</p>
              <p>• Nama badan usaha & alamat lengkap</p>
              <p>• Komitmen penerapan SMAP (ISO 37001)</p>
              <p>• Nama & jabatan penandatangan (Direktur Utama)</p>
              <p>• Jenis pengajuan SBU: Baru / Perpanjangan</p>
            </div>
          </CardContent>
        </Card>
      )}

      {documents.map((doc, i) => (
        <motion.div key={doc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
          <Card>
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-medium text-sm truncate">{doc.company_name || "Surat Pernyataan"}</span>
                  {statusBadge(doc.status)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Penandatangan: {doc.signatory_name} — {doc.signatory_position}
                </p>
                {doc.file_name && <p className="text-xs text-muted-foreground mt-0.5">📎 {doc.file_name}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">{new Date(doc.created_at).toLocaleDateString("id-ID")}</p>
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

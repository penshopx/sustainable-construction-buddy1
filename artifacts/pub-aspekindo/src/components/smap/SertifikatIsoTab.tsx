import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useSmapDocuments, type SmapDocument } from "@/hooks/useSmapDocuments";
import { useAuth } from "@/hooks/useAuth";
import { Award, Plus, Save, Trash2, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "@/components/ui/sonner-toast";
import { differenceInDays, parseISO } from "date-fns";

export default function SertifikatIsoTab() {
  const { profile } = useAuth();
  const { documents, loading, saveDocument, deleteDocument, uploadFile, openFile } = useSmapDocuments("sertifikat_iso");
  const [editing, setEditing] = useState<Partial<SmapDocument> | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleNew = () => {
    setEditing({
      doc_type: "sertifikat_iso",
      company_name: profile?.company || "",
      status: "draft",
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.document_number || !editing.issuing_body) {
      toast.error("Nomor sertifikat dan lembaga penerbit wajib diisi");
      return;
    }
    await saveDocument({ ...editing, doc_type: "sertifikat_iso" });
    setEditing(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing?.id) return;
    setUploading(true);
    const result = await uploadFile(file, editing.id);
    if (result) {
      setEditing(prev => prev ? { ...prev, file_url: result.url, file_name: result.name } : null);
      await saveDocument({ id: editing.id, doc_type: "sertifikat_iso", file_url: result.url, file_name: result.name });
    }
    setUploading(false);
  };

  const getExpiryStatus = (expiry: string | null) => {
    if (!expiry) return null;
    const days = differenceInDays(parseISO(expiry), new Date());
    if (days < 0) return { label: "Expired", color: "bg-destructive/20 text-destructive border-destructive/30", icon: AlertTriangle };
    if (days <= 90) return { label: `${days} hari lagi`, color: "bg-pub-amber/20 text-pub-amber border-pub-amber/30", icon: Clock };
    return { label: "Aktif", color: "bg-pub-emerald/20 text-pub-emerald border-pub-emerald/30", icon: CheckCircle2 };
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Memuat...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-heading font-semibold">Sertifikat SNI ISO 37001:2016</h3>
          <p className="text-xs text-muted-foreground">Sertifikasi Sistem Manajemen Anti Penyuapan — track masa berlaku & status verifikasi</p>
        </div>
        {!editing && (
          <Button size="sm" onClick={handleNew} className="gap-2">
            <Plus className="w-4 h-4" /> Tambah Sertifikat
          </Button>
        )}
      </div>

      {editing && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-2 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Form Sertifikat ISO 37001</CardTitle>
              <CardDescription>Upload scan sertifikat dan isi data untuk tracking</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Nama Badan Usaha</Label>
                  <Input value={editing.company_name || ""} onChange={e => setEditing(p => p ? { ...p, company_name: e.target.value } : null)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Nomor Sertifikat *</Label>
                  <Input value={editing.document_number || ""} onChange={e => setEditing(p => p ? { ...p, document_number: e.target.value } : null)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Lembaga Penerbit *</Label>
                  <Input value={editing.issuing_body || ""} onChange={e => setEditing(p => p ? { ...p, issuing_body: e.target.value } : null)} className="mt-1" placeholder="Lembaga Sertifikasi" />
                </div>
                <div>
                  <Label className="text-xs">Ruang Lingkup Sertifikasi</Label>
                  <Input value={editing.certificate_scope || ""} onChange={e => setEditing(p => p ? { ...p, certificate_scope: e.target.value } : null)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Tanggal Terbit</Label>
                  <Input type="date" value={editing.issued_date || ""} onChange={e => setEditing(p => p ? { ...p, issued_date: e.target.value } : null)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Tanggal Kadaluarsa</Label>
                  <Input type="date" value={editing.expiry_date || ""} onChange={e => setEditing(p => p ? { ...p, expiry_date: e.target.value } : null)} className="mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Catatan</Label>
                <Textarea value={editing.notes || ""} onChange={e => setEditing(p => p ? { ...p, notes: e.target.value } : null)} className="mt-1" rows={2} />
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
            <Award className="w-10 h-10 mx-auto opacity-40" />
            <p className="text-sm font-semibold text-foreground">Belum ada Sertifikat ISO 37001</p>
            <p className="text-xs">Tambahkan sertifikat SNI ISO 37001:2016 untuk tracking masa berlaku</p>
            <div className="text-left max-w-md mx-auto bg-muted/50 rounded-lg p-4 text-xs space-y-1.5">
              <p className="font-semibold text-foreground mb-2">🏅 Data sertifikat yang perlu diisi:</p>
              <p>• Nomor sertifikat (contoh: SMAP-37001-2024-00123)</p>
              <p>• Lembaga penerbit (contoh: TÜV NORD Indonesia)</p>
              <p>• Ruang lingkup sertifikasi (contoh: Jasa Pelaksana Konstruksi)</p>
              <p>• Tanggal terbit & kadaluarsa sertifikat</p>
              <p>• Upload scan sertifikat (PDF/JPG)</p>
            </div>
          </CardContent>
        </Card>
      )}

      {documents.map((doc, i) => {
        const expiry = getExpiryStatus(doc.expiry_date);
        return (
          <motion.div key={doc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Award className="w-4 h-4 text-pub-amber shrink-0" />
                    <span className="font-medium text-sm">No. {doc.document_number}</span>
                    {expiry && (
                      <Badge className={expiry.color}>
                        <expiry.icon className="w-3 h-3 mr-1" />{expiry.label}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Penerbit: {doc.issuing_body}</p>
                  {doc.certificate_scope && <p className="text-xs text-muted-foreground">Scope: {doc.certificate_scope}</p>}
                  {doc.file_name && <p className="text-xs text-muted-foreground mt-0.5">📎 {doc.file_name}</p>}
                </div>
                <div className="flex gap-1.5">
                  {doc.file_url && <Button variant="outline" size="sm" onClick={() => void openFile(doc)}>Lihat berkas</Button>}
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
        );
      })}
    </div>
  );
}

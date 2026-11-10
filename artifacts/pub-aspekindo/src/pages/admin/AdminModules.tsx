import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { Plus, Pencil, Trash2, GraduationCap, Search, Eye, FileEdit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Module {
  id: string;
  title: string;
  description: string;
  domain_id: string;
  level: string;
  duration_minutes: number;
  sort_order: number;
  content: string;
  job_segment: string;
}

interface Domain { id: string; name: string; }

const JOB_SEGMENTS = [
  { value: "", label: "Semua Jabatan (Umum)" },
  { value: "PJBU", label: "PJBU — Penanggung Jawab Badan Usaha" },
  { value: "PJTBU", label: "PJTBU — Penanggung Jawab Teknis Badan Usaha" },
  { value: "PJKSBU", label: "PJKSBU — Penanggung Jawab K3 Badan Usaha" },
  { value: "Manajer Proyek", label: "Manajer Proyek" },
  { value: "Site Manager", label: "Site Manager" },
  { value: "Manajer Keuangan", label: "Manajer Keuangan" },
  { value: "Manajer Tender", label: "Manajer Tender" },
  { value: "Manajer Legal", label: "Manajer Legal" },
  { value: "Manajer Logistik", label: "Manajer Logistik" },
  { value: "Manajer K3", label: "Manajer K3" },
];

export default function AdminModules() {
  const [modules, setModules] = useState<Module[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Module | null>(null);
  const [filterSegment, setFilterSegment] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const emptyForm = { title: "", description: "", domain_id: "", level: "Pemula", duration_minutes: 30, sort_order: 0, content: "", job_segment: "" };
  const [form, setForm] = useState(emptyForm);

  const fetchData = async () => {
    const [mRes, dRes] = await Promise.all([
      supabase.from("e_course_modules").select("*").order("sort_order"),
      supabase.from("competency_domains").select("id, name").order("sort_order"),
    ]);
    if (mRes.data) setModules(mRes.data as Module[]);
    if (dRes.data) setDomains(dRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (m: Module) => {
    setEditing(m);
    setForm({ title: m.title, description: m.description, domain_id: m.domain_id, level: m.level, duration_minutes: m.duration_minutes, sort_order: m.sort_order, content: m.content, job_segment: m.job_segment || "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.domain_id) { toast({ title: "Lengkapi data", variant: "destructive" }); return; }
    const payload = { ...form };

    if (editing) {
      const { error } = await supabase.from("e_course_modules").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Gagal update", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("e_course_modules").insert(payload);
      if (error) { toast({ title: "Gagal tambah", description: error.message, variant: "destructive" }); return; }
    }
    toast({ title: editing ? "Modul diupdate" : "Modul ditambahkan" });
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("e_course_modules").delete().eq("id", id);
    if (error) { toast({ title: "Gagal hapus", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Modul dihapus" });
    fetchData();
  };

  const domainName = (id: string) => domains.find(d => d.id === id)?.name || "-";

  const filteredModules = modules.filter(m => {
    if (filterSegment !== "all" && (m.job_segment || "") !== filterSegment) return false;
    if (searchQuery && !m.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-heading text-foreground flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-accent" /> Kelola Modul Pembelajaran Personel Manajerial BUJK
          </h2>
          <p className="text-sm text-muted-foreground">{modules.length} modul tersedia</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Tambah Modul</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cari modul..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterSegment} onValueChange={setFilterSegment}>
          <SelectTrigger className="w-full sm:w-[260px]"><SelectValue placeholder="Filter jabatan" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Jabatan</SelectItem>
            {JOB_SEGMENTS.map(s => (
              <SelectItem key={s.value || "__umum"} value={s.value || "__umum"}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Judul</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Jabatan Kerja</TableHead>
              <TableHead>Durasi</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Memuat...</TableCell></TableRow>
            ) : filteredModules.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Tidak ada modul ditemukan</TableCell></TableRow>
            ) : (
              filteredModules.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium max-w-[280px] truncate">{m.title}</TableCell>
                  <TableCell><Badge variant="secondary">{domainName(m.domain_id)}</Badge></TableCell>
                  <TableCell><Badge variant="outline">{m.level}</Badge></TableCell>
                  <TableCell>
                    {m.job_segment ? (
                      <Badge className="bg-primary/10 text-primary border-primary/20">{m.job_segment}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Umum</span>
                    )}
                  </TableCell>
                  <TableCell>{m.duration_minutes} menit</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Modul" : "Tambah Modul Baru"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Judul</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Domain</Label>
                <Select value={form.domain_id} onValueChange={v => setForm({ ...form, domain_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih domain" /></SelectTrigger>
                  <SelectContent>{domains.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Level</Label>
                <Select value={form.level} onValueChange={v => setForm({ ...form, level: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Pemula", "Muda", "Madya", "Utama"].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Jabatan Kerja (Segment)</Label>
              <Select value={form.job_segment || "__umum"} onValueChange={v => setForm({ ...form, job_segment: v === "__umum" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Pilih jabatan kerja" /></SelectTrigger>
                <SelectContent>
                  {JOB_SEGMENTS.map(s => (
                    <SelectItem key={s.value || "__umum"} value={s.value || "__umum"}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Durasi (menit)</Label>
                <Input type="number" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Urutan</Label>
                <Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div>
              <Label>Konten (Markdown)</Label>
              <Tabs defaultValue="edit" className="mt-1">
                <TabsList className="mb-2">
                  <TabsTrigger value="edit" className="gap-1.5"><FileEdit className="w-3.5 h-3.5" /> Edit</TabsTrigger>
                  <TabsTrigger value="preview" className="gap-1.5"><Eye className="w-3.5 h-3.5" /> Preview</TabsTrigger>
                </TabsList>
                <TabsContent value="edit">
                  <Textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={12} className="font-mono text-xs" />
                </TabsContent>
                <TabsContent value="preview">
                  <div className="border border-border rounded-lg p-4 min-h-[200px] max-h-[400px] overflow-y-auto bg-muted/20">
                    {form.content ? (
                      <MarkdownRenderer>{form.content}</MarkdownRenderer>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Belum ada konten untuk dipratinjau.</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSave}>{editing ? "Update" : "Simpan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

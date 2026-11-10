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
import { Plus, Pencil, Trash2, ClipboardCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import QuestionImport from "@/components/admin/QuestionImport";

interface Question {
  id: string;
  question_text: string;
  difficulty: string;
  domain_id: string;
  options: string[];
  correct_answer: number;
  explanation: string;
}

interface Domain {
  id: string;
  name: string;
}

export default function AdminQuestions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const { toast } = useToast();

  const emptyForm = { question_text: "", difficulty: "Pemula", domain_id: "", options: ["", "", "", ""], correct_answer: 0, explanation: "" };
  const [form, setForm] = useState(emptyForm);

  const fetchData = async () => {
    const [qRes, dRes] = await Promise.all([
      supabase.from("questions").select("*").order("created_at", { ascending: false }),
      supabase.from("competency_domains").select("id, name").order("sort_order"),
    ]);
    if (qRes.data) setQuestions(qRes.data.map(q => ({ ...q, options: Array.isArray(q.options) ? q.options as string[] : [] })));
    if (dRes.data) setDomains(dRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (q: Question) => {
    setEditing(q);
    setForm({ question_text: q.question_text, difficulty: q.difficulty, domain_id: q.domain_id, options: [...q.options], correct_answer: q.correct_answer, explanation: q.explanation });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.question_text || !form.domain_id) { toast({ title: "Lengkapi data", variant: "destructive" }); return; }
    const payload = { question_text: form.question_text, difficulty: form.difficulty, domain_id: form.domain_id, options: form.options, correct_answer: form.correct_answer, explanation: form.explanation };

    if (editing) {
      const { error } = await supabase.from("questions").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Gagal update", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("questions").insert(payload);
      if (error) { toast({ title: "Gagal tambah", description: error.message, variant: "destructive" }); return; }
    }
    toast({ title: editing ? "Soal diupdate" : "Soal ditambahkan" });
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) { toast({ title: "Gagal hapus", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Soal dihapus" });
    fetchData();
  };

  const domainName = (id: string) => domains.find(d => d.id === id)?.name || "-";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-heading text-foreground flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-accent" /> Kelola Soal
          </h2>
          <p className="text-sm text-muted-foreground">{questions.length} soal tersedia</p>
        </div>
        <div className="flex items-center gap-2">
          <QuestionImport domains={domains} onImportDone={fetchData} />
          <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Tambah Soal</Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Pertanyaan</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Kesulitan</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Memuat...</TableCell></TableRow>
            ) : questions.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Belum ada soal</TableCell></TableRow>
            ) : (
              questions.map(q => (
                <TableRow key={q.id}>
                  <TableCell className="font-medium truncate max-w-xs">{q.question_text}</TableCell>
                  <TableCell><Badge variant="secondary">{domainName(q.domain_id)}</Badge></TableCell>
                  <TableCell><Badge variant="outline">{q.difficulty}</Badge></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(q)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(q.id)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Soal" : "Tambah Soal Baru"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Pertanyaan</Label>
              <Textarea value={form.question_text} onChange={e => setForm({ ...form, question_text: e.target.value })} />
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
                <Label>Kesulitan</Label>
                <Select value={form.difficulty} onValueChange={v => setForm({ ...form, difficulty: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Pemula", "Muda", "Madya", "Utama"].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Opsi Jawaban</Label>
              {form.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${form.correct_answer === i ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>{String.fromCharCode(65 + i)}</span>
                  <Input value={opt} onChange={e => { const o = [...form.options]; o[i] = e.target.value; setForm({ ...form, options: o }); }} placeholder={`Opsi ${String.fromCharCode(65 + i)}`} className="flex-1" />
                  <Button type="button" variant={form.correct_answer === i ? "default" : "outline"} size="sm" onClick={() => setForm({ ...form, correct_answer: i })}>
                    {form.correct_answer === i ? "✓ Benar" : "Tandai"}
                  </Button>
                </div>
              ))}
            </div>
            <div>
              <Label>Penjelasan</Label>
              <Textarea value={form.explanation} onChange={e => setForm({ ...form, explanation: e.target.value })} />
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

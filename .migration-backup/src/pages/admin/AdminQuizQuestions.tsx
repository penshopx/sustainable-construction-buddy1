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
import { Plus, Pencil, Trash2, HelpCircle, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner-toast";
import type { Json, TablesInsert } from "@/integrations/supabase/types";

interface QuizQuestion {
  id: string;
  module_id: string;
  question_text: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  sort_order: number;
}

interface Module {
  id: string;
  title: string;
}

function parseStringArray(value: Json): string[] {
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
        return parsed;
      }
    } catch {
      // Keep malformed legacy values from breaking the admin list.
    }
  }

  return [];
}

export default function AdminQuizQuestions() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QuizQuestion | null>(null);

  const emptyForm = { module_id: "", question_text: "", options: ["", "", "", ""], correct_answer: 0, explanation: "", sort_order: 0 };
  const [form, setForm] = useState(emptyForm);

  const fetchData = async () => {
    const [qRes, mRes] = await Promise.all([
      supabase.from("module_quiz_questions").select("*").order("sort_order"),
      supabase.from("e_course_modules").select("id, title").order("sort_order"),
    ]);
    if (qRes.data) setQuestions(qRes.data.map(q => ({
      ...q,
      options: parseStringArray(q.options),
    })));
    if (mRes.data) setModules(mRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = selectedModule === "all" ? questions : questions.filter(q => q.module_id === selectedModule);
  const moduleName = (id: string) => modules.find(m => m.id === id)?.title || "-";

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, module_id: selectedModule !== "all" ? selectedModule : "" });
    setDialogOpen(true);
  };
  const openEdit = (q: QuizQuestion) => {
    setEditing(q);
    setForm({ module_id: q.module_id, question_text: q.question_text, options: [...q.options], correct_answer: q.correct_answer, explanation: q.explanation, sort_order: q.sort_order });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.question_text || !form.module_id) { toast.error("Lengkapi data soal dan modul"); return; }
    const payload: TablesInsert<"module_quiz_questions"> = { module_id: form.module_id, question_text: form.question_text, options: form.options, correct_answer: form.correct_answer, explanation: form.explanation, sort_order: form.sort_order };

    if (editing) {
      const { error } = await supabase.from("module_quiz_questions").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Soal kuis diperbarui");
    } else {
      const { error } = await supabase.from("module_quiz_questions").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Soal kuis ditambahkan");
    }
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("module_quiz_questions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Soal kuis dihapus");
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading text-foreground flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-primary" /> Kelola Soal Kuis Pembelajaran
          </h2>
          <p className="text-sm text-muted-foreground">{questions.length} soal kuis tersedia</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Tambah Soal</Button>
      </div>

      {/* Module filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedModule("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedModule === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
        >
          Semua ({questions.length})
        </button>
        {modules.map(m => {
          const count = questions.filter(q => q.module_id === m.id).length;
          return (
            <button
              key={m.id}
              onClick={() => setSelectedModule(m.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedModule === m.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
            >
              {m.title.length > 25 ? m.title.slice(0, 25) + "…" : m.title} ({count})
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Pertanyaan</TableHead>
              <TableHead>Modul</TableHead>
              <TableHead>Jawaban</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Belum ada soal kuis</TableCell></TableRow>
            ) : (
              filtered.map(q => (
                <TableRow key={q.id}>
                  <TableCell className="font-medium">{q.question_text.length > 80 ? q.question_text.slice(0, 80) + "…" : q.question_text}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px]">{moduleName(q.module_id).length > 20 ? moduleName(q.module_id).slice(0, 20) + "…" : moduleName(q.module_id)}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{q.options[q.correct_answer]?.slice(0, 30)}</Badge></TableCell>
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
          <DialogHeader><DialogTitle>{editing ? "Edit Soal Kuis" : "Tambah Soal Kuis"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Modul</Label>
              <Select value={form.module_id} onValueChange={v => setForm({ ...form, module_id: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih modul" /></SelectTrigger>
                <SelectContent>{modules.map(m => <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pertanyaan</Label>
              <Textarea value={form.question_text} onChange={e => setForm({ ...form, question_text: e.target.value })} />
            </div>
            <div>
              <Label>Opsi Jawaban</Label>
              {form.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${form.correct_answer === i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {String.fromCharCode(65 + i)}
                  </span>
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
            <div>
              <Label>Urutan</Label>
              <Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
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

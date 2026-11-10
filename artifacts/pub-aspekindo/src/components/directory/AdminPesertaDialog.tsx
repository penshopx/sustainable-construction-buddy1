import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Pencil } from "lucide-react";
import { toast } from "@/components/ui/sonner-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { usePrograms } from "@/hooks/usePrograms";
import type { PubParticipantEntry } from "@/hooks/usePubParticipantsDirectory";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

interface Props {
  mode: "add" | "edit";
  participant?: PubParticipantEntry;
}

const emptyForm = {
  full_name: "", company: "", position: "", email: "", phone: "",
  kta_number: "", attendance_status: "registered", notes: "", program_id: "",
  checked_in_at: "", checked_out_at: "",
};

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export default function AdminPesertaDialog({ mode, participant }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const { data: programs = [] } = usePrograms();

  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (mode === "edit" && participant && open) {
      setForm({
        full_name: participant.full_name,
        company: participant.company,
        position: participant.position,
        email: participant.email,
        phone: participant.phone,
        kta_number: participant.kta_number,
        attendance_status: participant.attendance_status,
        notes: participant.notes,
        program_id: participant.program_id,
        checked_in_at: toLocalInput(participant.checked_in_at),
        checked_out_at: toLocalInput(participant.checked_out_at),
      });
    } else if (mode === "add" && open) {
      setForm(emptyForm);
    }
  }, [mode, participant, open]);

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast.error("Nama wajib diisi");
      return;
    }
    if (!form.program_id) {
      toast.error("Program wajib dipilih");
      return;
    }

    setSaving(true);
    const payload: TablesInsert<"pub_program_participants"> = {
      full_name: form.full_name.trim(),
      company: form.company.trim(),
      position: form.position.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      kta_number: form.kta_number.trim(),
      attendance_status: form.attendance_status,
      notes: form.notes.trim(),
      program_id: form.program_id,
      checked_in_at: form.checked_in_at ? new Date(form.checked_in_at).toISOString() : null,
      checked_out_at: form.checked_out_at ? new Date(form.checked_out_at).toISOString() : null,
    };

    let error;
    if (mode === "edit" && participant) {
      ({ error } = await supabase.from("pub_program_participants").update(payload satisfies TablesUpdate<"pub_program_participants">).eq("id", participant.id));
    } else {
      ({ error } = await supabase.from("pub_program_participants").insert(payload));
    }

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(mode === "edit" ? "Peserta diperbarui" : "Peserta ditambahkan");
    qc.invalidateQueries({ queryKey: ["pub-participants-directory"] });
    qc.invalidateQueries({ queryKey: ["pub-program-participants"] });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "add" ? (
          <Button size="sm" className="h-9 gap-1.5 text-xs">
            <UserPlus className="w-3.5 h-3.5" /> Tambah Peserta
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {mode === "add" ? <><UserPlus className="w-5 h-5" /> Tambah Peserta PUB</> : <><Pencil className="w-5 h-5" /> Edit Peserta</>}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label className="text-xs">Program *</Label>
            <Select value={form.program_id} onValueChange={(v) => update("program_id", v)}>
              <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="Pilih program" /></SelectTrigger>
              <SelectContent>
                {programs.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Nama Lengkap *</Label>
            <Input value={form.full_name} onChange={(e) => update("full_name", e.target.value)} placeholder="Nama peserta" className="h-9 text-sm mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Utusan BUJK</Label>
              <Input value={form.company} onChange={(e) => update("company", e.target.value)} placeholder="PT ..." className="h-9 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">No. KTA</Label>
              <Input value={form.kta_number} onChange={(e) => update("kta_number", e.target.value)} placeholder="KTA-XXXX" className="h-9 text-sm mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Jabatan</Label>
              <Input value={form.position} onChange={(e) => update("position", e.target.value)} placeholder="Jabatan" className="h-9 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.attendance_status} onValueChange={(v) => update("attendance_status", v)}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="registered">Terdaftar</SelectItem>
                  <SelectItem value="attended">Hadir</SelectItem>
                  <SelectItem value="absent">Tidak Hadir</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className="h-9 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">Telepon</Label>
              <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} className="h-9 text-sm mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Check-In</Label>
              <Input type="datetime-local" value={form.checked_in_at} onChange={(e) => update("checked_in_at", e.target.value)} className="h-9 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">Check-Out</Label>
              <Input type="datetime-local" value={form.checked_out_at} onChange={(e) => update("checked_out_at", e.target.value)} className="h-9 text-sm mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Catatan</Label>
            <Input value={form.notes} onChange={(e) => update("notes", e.target.value)} className="h-9 text-sm mt-1" />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Menyimpan..." : mode === "edit" ? "Simpan Perubahan" : "Tambah Peserta"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

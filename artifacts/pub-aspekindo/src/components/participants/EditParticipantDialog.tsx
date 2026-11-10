import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";
import { toast } from "@/components/ui/sonner-toast";
import { useUpdateParticipant, PubProgramParticipant } from "@/hooks/useParticipants";

interface Props {
  participant: PubProgramParticipant;
}

export function EditParticipantDialog({ participant }: Props) {
  const [open, setOpen] = useState(false);
  const update = useUpdateParticipant();
  const [form, setForm] = useState({
    full_name: participant.full_name,
    company: participant.company,
    position: participant.position,
    email: participant.email,
    phone: participant.phone,
    notes: participant.notes,
  });

  const handleOpen = (v: boolean) => {
    if (v) setForm({
      full_name: participant.full_name,
      company: participant.company,
      position: participant.position,
      email: participant.email,
      phone: participant.phone,
      notes: participant.notes,
    });
    setOpen(v);
  };

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast.error("Nama wajib diisi");
      return;
    }
    update.mutate(
      {
        id: participant.id,
        full_name: form.full_name.trim(),
        company: form.company.trim(),
        position: form.position.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        notes: form.notes.trim(),
      },
      {
        onSuccess: () => {
          toast.success("Data peserta berhasil diperbarui");
          setOpen(false);
        },
        onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Gagal memperbarui data"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Pencil className="w-5 h-5" /> Edit Peserta
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label className="text-xs">Nama Lengkap *</Label>
            <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} className="h-9 text-sm mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Perusahaan</Label>
              <Input value={form.company} onChange={(e) => set("company", e.target.value)} className="h-9 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">Jabatan</Label>
              <Input value={form.position} onChange={(e) => set("position", e.target.value)} className="h-9 text-sm mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="h-9 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">Telepon</Label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} className="h-9 text-sm mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Catatan</Label>
            <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} className="h-9 text-sm mt-1" />
          </div>
          <Button type="submit" className="w-full" disabled={update.isPending}>
            {update.isPending ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

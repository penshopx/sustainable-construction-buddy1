import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus } from "lucide-react";
import { toast } from "@/components/ui/sonner-toast";
import { useCreateParticipant } from "@/hooks/useParticipants";

interface Props {
  programId: string;
}

export function AddParticipantDialog({ programId }: Props) {
  const [open, setOpen] = useState(false);
  const create = useCreateParticipant();
  const [form, setForm] = useState({
    full_name: "",
    company: "",
    position: "",
    email: "",
    phone: "",
    notes: "",
  });

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast.error("Nama wajib diisi");
      return;
    }
    create.mutate(
      {
        program_id: programId,
        full_name: form.full_name.trim(),
        company: form.company.trim(),
        position: form.position.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        attendance_status: "registered",
        notes: form.notes.trim(),
      },
      {
        onSuccess: () => {
          toast.success("Peserta berhasil ditambahkan");
          setForm({ full_name: "", company: "", position: "", email: "", phone: "", notes: "" });
          setOpen(false);
        },
        onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Gagal menambahkan peserta"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-9 gap-1.5 text-xs">
          <UserPlus className="w-3.5 h-3.5" /> Tambah Peserta
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserPlus className="w-5 h-5" /> Tambah Peserta Baru
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label className="text-xs">Nama Lengkap *</Label>
            <Input value={form.full_name} onChange={(e) => update("full_name", e.target.value)} placeholder="Nama lengkap peserta" className="h-9 text-sm mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Perusahaan</Label>
              <Input value={form.company} onChange={(e) => update("company", e.target.value)} placeholder="PT ..." className="h-9 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">Jabatan</Label>
              <Input value={form.position} onChange={(e) => update("position", e.target.value)} placeholder="Jabatan" className="h-9 text-sm mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="email@contoh.com" className="h-9 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">Telepon</Label>
              <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="08xxxxxxxxxx" className="h-9 text-sm mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Catatan</Label>
            <Input value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Catatan opsional" className="h-9 text-sm mt-1" />
          </div>
          <Button type="submit" className="w-full" disabled={create.isPending}>
            {create.isPending ? "Menyimpan..." : "Simpan Peserta"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

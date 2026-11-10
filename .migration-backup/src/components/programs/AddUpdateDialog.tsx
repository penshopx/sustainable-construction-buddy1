import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Newspaper } from "lucide-react";
import { toast } from "@/components/ui/sonner-toast";
import { useCreateProgramUpdate } from "@/hooks/usePrograms";

interface Props {
  programId: string;
}

export function AddUpdateDialog({ programId }: Props) {
  const [open, setOpen] = useState(false);
  const create = useCreateProgramUpdate();
  const [form, setForm] = useState({ title: "", content: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = form.title.trim();
    const content = form.content.trim();
    if (!title) return toast.error("Judul wajib diisi");
    if (!content) return toast.error("Konten wajib diisi");

    create.mutate(
      { program_id: programId, title, content },
      {
        onSuccess: () => {
          toast.success("Update berhasil ditambahkan");
          setForm({ title: "", content: "" });
          setOpen(false);
        },
        onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Gagal menambahkan update"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-9 gap-1.5 text-xs">
          <Newspaper className="w-3.5 h-3.5" /> Tambah Update
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Newspaper className="w-5 h-5" /> Tambah Update Baru
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label className="text-xs">Judul *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Judul update"
              maxLength={200}
              className="h-9 text-sm mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Konten *</Label>
            <Textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="Tulis konten update di sini..."
              maxLength={2000}
              rows={5}
              className="text-sm mt-1"
            />
          </div>
          <Button type="submit" className="w-full" disabled={create.isPending}>
            {create.isPending ? "Menyimpan..." : "Simpan Update"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

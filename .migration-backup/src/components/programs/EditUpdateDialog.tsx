import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";
import { toast } from "@/components/ui/sonner-toast";
import { useUpdateProgramUpdate } from "@/hooks/usePrograms";

interface Props {
  update: { id: string; title: string; content: string };
}

export function EditUpdateDialog({ update }: Props) {
  const [open, setOpen] = useState(false);
  const mutation = useUpdateProgramUpdate();
  const [form, setForm] = useState({ title: update.title, content: update.content });

  const handleOpen = (v: boolean) => {
    if (v) setForm({ title: update.title, content: update.content });
    setOpen(v);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = form.title.trim();
    const content = form.content.trim();
    if (!title) return toast.error("Judul wajib diisi");
    if (!content) return toast.error("Konten wajib diisi");

    mutation.mutate(
      { id: update.id, title, content },
      {
        onSuccess: () => {
          toast.success("Update berhasil diperbarui");
          setOpen(false);
        },
        onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Gagal memperbarui update"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Pencil className="w-5 h-5" /> Edit Update
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label className="text-xs">Judul *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              maxLength={200}
              className="h-9 text-sm mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Konten *</Label>
            <Textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              maxLength={2000}
              rows={5}
              className="text-sm mt-1"
            />
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

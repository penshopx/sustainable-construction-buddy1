import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ImagePlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  directoryId: string;
}

export default function GalleryUpload({ directoryId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [projectName, setProjectName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("bujk-gallery")
        .upload(path, file);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("bujk-gallery")
        .getPublicUrl(path);

      const { error: insertErr } = await supabase
        .from("bujk_gallery")
        .insert({
          directory_id: directoryId,
          user_id: user.id,
          image_url: urlData.publicUrl,
          caption,
          project_name: projectName,
        });
      if (insertErr) throw insertErr;

      qc.invalidateQueries({ queryKey: ["bujk-gallery", directoryId] });
      toast({ title: "Berhasil", description: "Foto berhasil diunggah." });
      setCaption("");
      setProjectName("");
      setOpen(false);
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Gagal mengunggah foto.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ImagePlus className="w-4 h-4" /> Tambah Foto
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Foto Proyek</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Foto *</Label>
            <Input type="file" accept="image/*" ref={fileRef} />
          </div>
          <div className="space-y-2">
            <Label>Nama Proyek</Label>
            <Input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Gedung Kantor ABC" />
          </div>
          <div className="space-y-2">
            <Label>Keterangan</Label>
            <Input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Tampak depan gedung selesai" />
          </div>
          <Button onClick={handleUpload} disabled={uploading} className="w-full">
            {uploading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Mengunggah...</> : "Upload"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

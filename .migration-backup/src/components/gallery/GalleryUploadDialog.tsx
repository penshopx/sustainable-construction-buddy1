import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImagePlus, Upload, X } from "lucide-react";
import { toast } from "@/components/ui/sonner-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCreateGalleryItem } from "@/hooks/usePrograms";

interface Props {
  programId: string;
}

export function GalleryUploadDialog({ programId }: Props) {
  const [open, setOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const createGallery = useCreateGalleryItem();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Hanya file gambar yang diperbolehkan");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 5MB");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const clearFile = () => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error("Pilih foto terlebih dahulu");

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${programId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("program-images")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("program-images")
        .getPublicUrl(path);

      await createGallery.mutateAsync({
        program_id: programId,
        image_url: urlData.publicUrl,
        caption: caption.trim(),
      });

      toast.success("Foto berhasil diunggah");
      setCaption("");
      clearFile();
      setOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunggah foto");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) clearFile(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-9 gap-1.5 text-xs">
          <ImagePlus className="w-3.5 h-3.5" /> Upload Foto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ImagePlus className="w-5 h-5" /> Upload Foto Galeri
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!preview ? (
            <label
              htmlFor="gallery-file"
              className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 cursor-pointer hover:border-primary/50 transition-colors"
            >
              <Upload className="w-8 h-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Klik atau seret foto ke sini</span>
              <span className="text-[10px] text-muted-foreground">JPG, PNG, WebP • Maks 5MB</span>
              <input
                ref={inputRef}
                id="gallery-file"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          ) : (
            <div className="relative">
              <img src={preview} alt="Preview" className="w-full aspect-video object-cover rounded-lg" />
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="absolute top-2 right-2 h-7 w-7"
                onClick={clearFile}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
          <div>
            <Label className="text-xs">Keterangan (opsional)</Label>
            <Input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Deskripsi singkat foto"
              className="h-9 text-sm mt-1"
            />
          </div>
          <Button type="submit" className="w-full" disabled={uploading || !file}>
            {uploading ? "Mengunggah..." : "Simpan Foto"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

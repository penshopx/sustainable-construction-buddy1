import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Award, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils";

interface Props {
  open: boolean;
  level: string;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function GenerateCertDialog({ open, level, onOpenChange, onSuccess }: Props) {
  const { toast } = useToast();
  const [moduleName, setModuleName] = useState("");
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!moduleName.trim()) {
      toast({ title: "Error", description: "Nama modul wajib diisi", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("generate-certificate", {
        body: { level, module_name: moduleName.trim() },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (res.error) throw res.error;
      if (res.data?.error) {
        toast({ title: "Gagal", description: res.data.error, variant: "destructive" });
      } else {
        toast({ title: "Berhasil!", description: `Sertifikat modul "${moduleName}" berhasil diterbitkan.` });
        onSuccess();
        onOpenChange(false);
        setModuleName("");
      }
    } catch (err: unknown) {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-accent" />
            Terbitkan Sertifikat — Level {level}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="module_name">Nama Modul / Materi</Label>
            <Input
              id="module_name"
              placeholder="Contoh: Manajemen Mutu Konstruksi"
              value={moduleName}
              onChange={(e) => setModuleName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Nama modul akan tercantum pada sertifikat yang diterbitkan.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>Batal</Button>
          <Button onClick={handleGenerate} disabled={generating || !moduleName.trim()}>
            {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Membuat...</> : <><Award className="w-4 h-4 mr-2" /> Terbitkan</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

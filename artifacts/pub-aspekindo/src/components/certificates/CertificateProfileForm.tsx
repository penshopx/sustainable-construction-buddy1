import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Upload, User, Building2, Briefcase, Image, PenTool, Save, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils";

interface Props {
  logoUrl: string;
  signatureUrl: string;
  onUpdate: (logoUrl: string, signatureUrl: string) => void;
}

export default function CertificateProfileForm({ logoUrl, signatureUrl, onUpdate }: Props) {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [company, setCompany] = useState(profile?.company || "");
  const [position, setPosition] = useState(profile?.position || "");
  const [logoPreview, setLogoPreview] = useState(logoUrl);
  const [sigPreview, setSigPreview] = useState(signatureUrl);
  const [saving, setSaving] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const sigRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File, folder: string) => {
    const path = `${folder}/${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage
      .from("program-images")
      .upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("program-images").getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const handleFileChange = async (file: File, type: "logo" | "signature") => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      if (type === "logo") setLogoPreview(url);
      else setSigPreview(url);
    };
    reader.readAsDataURL(file);

    try {
      const uploaded = await uploadFile(file, type === "logo" ? "cert-logos" : "cert-signatures");
      if (type === "logo") onUpdate(uploaded, signatureUrl);
      else onUpdate(logoUrl, uploaded);
      toast({ title: "Upload berhasil" });
    } catch (err: unknown) {
      toast({ title: "Upload gagal", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, company, position })
        .eq("user_id", profile.user_id);
      if (error) throw error;
      await refreshProfile();
      toast({ title: "Profil disimpan" });
    } catch (err: unknown) {
      toast({ title: "Gagal menyimpan", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-heading flex items-center gap-2">
          <User className="w-5 h-5 text-accent" />
          Profil Sertifikat
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm">
              <User className="w-3.5 h-3.5" /> Nama Lengkap
            </Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nama lengkap" />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm">
              <Building2 className="w-3.5 h-3.5" /> Perusahaan
            </Label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nama perusahaan" />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm">
              <Briefcase className="w-3.5 h-3.5" /> Jabatan
            </Label>
            <Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Jabatan" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Logo */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm">
              <Image className="w-3.5 h-3.5" /> Logo Perusahaan
            </Label>
            <div
              className="border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-accent/50 transition-colors min-h-[80px] justify-center"
              onClick={() => logoRef.current?.click()}
            >
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="h-12 object-contain" />
              ) : (
                <>
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Klik untuk upload</span>
                </>
              )}
            </div>
            <Input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0], "logo")} />
          </div>

          {/* Signature */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm">
              <PenTool className="w-3.5 h-3.5" /> Tanda Tangan Digital
            </Label>
            <div
              className="border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-accent/50 transition-colors min-h-[80px] justify-center"
              onClick={() => sigRef.current?.click()}
            >
              {sigPreview ? (
                <img src={sigPreview} alt="Signature" className="h-12 object-contain" />
              ) : (
                <>
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Klik untuk upload</span>
                </>
              )}
            </div>
            <Input ref={sigRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0], "signature")} />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSaveProfile} disabled={saving} size="sm">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Simpan Profil
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

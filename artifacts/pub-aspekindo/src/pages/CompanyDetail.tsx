import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BujkEntry } from "@/hooks/useBujkDirectory";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Building2, MapPin, Phone, Mail, Globe, Award, Calendar,
  ArrowLeft, FileText, Trash2, Loader2, ImageIcon
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import GalleryUpload from "@/components/directory/GalleryUpload";

type GalleryItem = Tables<"bujk_gallery">;

const qualLabel: Record<string, string> = { kecil: "Kecil", menengah: "Menengah", besar: "Besar" };
const qualColor: Record<string, string> = {
  kecil: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  menengah: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  besar: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
};

export default function CompanyDetail() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: company, isLoading } = useQuery({
    queryKey: ["bujk-detail", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bujk_directory")
        .select("*")
        .eq("id", companyId!)
        .single();
      if (error) throw error;
      return data as unknown as BujkEntry;
    },
    enabled: !!companyId,
  });

  const { data: gallery = [] } = useQuery({
    queryKey: ["bujk-gallery", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bujk_gallery")
        .select("*")
        .eq("directory_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as GalleryItem[];
    },
    enabled: !!companyId,
  });

  const isOwner = company?.user_id === user?.id;

  const handleDeletePhoto = async (item: GalleryItem) => {
    try {
      // Extract path from URL
      const url = new URL(item.image_url);
      const pathParts = url.pathname.split("/bujk-gallery/");
      if (pathParts[1]) {
        await supabase.storage.from("bujk-gallery").remove([pathParts[1]]);
      }
      const { error } = await supabase
        .from("bujk_gallery")
        .delete()
        .eq("id", item.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["bujk-gallery", companyId] });
      toast({ title: "Foto dihapus" });
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Gagal menghapus foto", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="font-heading font-semibold">Perusahaan tidak ditemukan</p>
        <Button variant="link" onClick={() => navigate("/direktori")}>Kembali ke direktori</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/direktori")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Building2 className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold font-heading text-foreground">{company.company_name}</h1>
            <Badge className={qualColor[company.qualification] || ""} variant="secondary">
              {qualLabel[company.qualification] || company.qualification}
            </Badge>
          </div>
          {(company.city || company.province) && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {[company.city, company.province].filter(Boolean).join(", ")}
            </p>
          )}
        </div>
      </div>

      {company.description && (
        <p className="text-muted-foreground">{company.description}</p>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Informasi Perusahaan */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Informasi Perusahaan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="NIB" value={company.nib} />
            <InfoRow label="NPWP" value={company.npwp} />
            <InfoRow label="Kualifikasi" value={qualLabel[company.qualification]} />
            <InfoRow label="Sub Klasifikasi" value={company.sub_classification} />
            <InfoRow label="Nomor SBU" value={company.sbu_number} />
            {company.sbu_expiry && (
              <InfoRow
                label="Masa Berlaku SBU"
                value={format(new Date(company.sbu_expiry), "dd MMMM yyyy", { locale: idLocale })}
              />
            )}
            {company.address && <InfoRow label="Alamat" value={company.address} />}
          </CardContent>
        </Card>

        {/* Kontak */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary" /> Kontak
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {company.phone && (
              <a href={`tel:${company.phone}`} className="flex items-center gap-3 text-sm hover:text-primary transition-colors">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Phone className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Telepon</p>
                  <p className="font-medium text-foreground">{company.phone}</p>
                </div>
              </a>
            )}
            {company.email && (
              <a href={`mailto:${company.email}`} className="flex items-center gap-3 text-sm hover:text-primary transition-colors">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium text-foreground">{company.email}</p>
                </div>
              </a>
            )}
            {company.website && (
              <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm hover:text-primary transition-colors">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Globe className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Website</p>
                  <p className="font-medium text-foreground">{company.website}</p>
                </div>
              </a>
            )}
            {!company.phone && !company.email && !company.website && (
              <p className="text-sm text-muted-foreground italic">Belum ada informasi kontak</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Galeri Proyek */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-primary" /> Galeri Proyek
            </CardTitle>
            {isOwner && <GalleryUpload directoryId={company.id} />}
          </div>
        </CardHeader>
        <CardContent>
          {gallery.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Belum ada foto proyek</p>
              {isOwner && <p className="text-xs mt-1">Tambahkan foto proyek untuk menampilkan portofolio perusahaan.</p>}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {gallery.map(item => (
                <div key={item.id} className="group relative rounded-lg overflow-hidden border bg-muted/50">
                  <img
                    src={item.image_url}
                    alt={item.caption || item.project_name}
                    className="w-full aspect-[4/3] object-cover"
                    loading="lazy"
                  />
                  <div className="p-2 space-y-0.5">
                    {item.project_name && (
                      <p className="text-xs font-medium text-foreground truncate">{item.project_name}</p>
                    )}
                    {item.caption && (
                      <p className="text-xs text-muted-foreground truncate">{item.caption}</p>
                    )}
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => handleDeletePhoto(item)}
                      className="absolute top-2 right-2 w-7 h-7 bg-destructive/80 text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-foreground font-medium text-right">{value}</span>
    </div>
  );
}

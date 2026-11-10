import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil } from "lucide-react";
import { useBujkDirectory } from "@/hooks/useBujkDirectory";
import type { TablesUpdate } from "@/integrations/supabase/types";

const QUALIFICATIONS = [
  { value: "kecil", label: "Kecil" },
  { value: "menengah", label: "Menengah" },
  { value: "besar", label: "Besar" },
];

const PROVINCES = [
  "DKI Jakarta", "Jawa Barat", "Jawa Tengah", "Jawa Timur", "Banten",
  "DI Yogyakarta", "Sumatera Utara", "Sumatera Barat", "Sumatera Selatan",
  "Riau", "Kepulauan Riau", "Kalimantan Timur", "Kalimantan Selatan",
  "Sulawesi Selatan", "Sulawesi Utara", "Bali", "NTB", "NTT", "Papua",
  "Lampung", "Bengkulu", "Jambi", "Aceh", "Maluku", "Gorontalo",
];

export default function RegisterBujkDialog() {
  const { myEntryQuery, upsertMutation } = useBujkDirectory();
  const existing = myEntryQuery.data;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    nib: "",
    npwp: "",
    address: "",
    city: "",
    province: "",
    phone: "",
    email: "",
    website: "",
    qualification: "menengah",
    sub_classification: "",
    sbu_number: "",
    sbu_expiry: "",
    description: "",
    is_published: true,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        company_name: existing.company_name,
        nib: existing.nib,
        npwp: existing.npwp,
        address: existing.address,
        city: existing.city,
        province: existing.province,
        phone: existing.phone,
        email: existing.email,
        website: existing.website,
        qualification: existing.qualification,
        sub_classification: existing.sub_classification,
        sbu_number: existing.sbu_number,
        sbu_expiry: existing.sbu_expiry || "",
        description: existing.description,
        is_published: existing.is_published,
      });
    }
  }, [existing]);

  const handleSubmit = () => {
    if (!form.company_name.trim()) return;
    upsertMutation.mutate(
      { ...form, sbu_expiry: form.sbu_expiry || null } satisfies TablesUpdate<"bujk_directory">,
      { onSuccess: () => setOpen(false) }
    );
  };

  const set = <K extends keyof typeof form>(key: K, val: typeof form[K]) =>
    setForm(p => ({ ...p, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={existing ? "outline" : "default"} className="gap-2">
          {existing ? <><Pencil className="w-4 h-4" /> Edit Perusahaan</> : <><Plus className="w-4 h-4" /> Daftarkan Perusahaan</>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit" : "Daftarkan"} Perusahaan</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nama Perusahaan *</Label>
              <Input value={form.company_name} onChange={e => set("company_name", e.target.value)} placeholder="PT Contoh Jaya" />
            </div>
            <div className="space-y-2">
              <Label>NIB</Label>
              <Input value={form.nib} onChange={e => set("nib", e.target.value)} placeholder="1234567890" />
            </div>
            <div className="space-y-2">
              <Label>NPWP</Label>
              <Input value={form.npwp} onChange={e => set("npwp", e.target.value)} placeholder="00.000.000.0-000.000" />
            </div>
            <div className="space-y-2">
              <Label>Kualifikasi</Label>
              <Select value={form.qualification} onValueChange={v => set("qualification", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QUALIFICATIONS.map(q => <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sub Klasifikasi</Label>
              <Input value={form.sub_classification} onChange={e => set("sub_classification", e.target.value)} placeholder="BG004, SI003, ..." />
            </div>
            <div className="space-y-2">
              <Label>Nomor SBU</Label>
              <Input value={form.sbu_number} onChange={e => set("sbu_number", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Masa Berlaku SBU</Label>
              <Input type="date" value={form.sbu_expiry} onChange={e => set("sbu_expiry", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Kota</Label>
              <Input value={form.city} onChange={e => set("city", e.target.value)} placeholder="Jakarta Selatan" />
            </div>
            <div className="space-y-2">
              <Label>Provinsi</Label>
              <Select value={form.province} onValueChange={v => set("province", v)}>
                <SelectTrigger><SelectValue placeholder="Pilih provinsi" /></SelectTrigger>
                <SelectContent>
                  {PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Telepon</Label>
              <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="021-1234567" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="info@contoh.co.id" />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input value={form.website} onChange={e => set("website", e.target.value)} placeholder="https://contoh.co.id" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Alamat Lengkap</Label>
            <Textarea value={form.address} onChange={e => set("address", e.target.value)} placeholder="Jl. Contoh No. 1..." rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Deskripsi Perusahaan</Label>
            <Textarea value={form.description} onChange={e => set("description", e.target.value)} placeholder="Bidang usaha, spesialisasi, pengalaman..." rows={3} />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.is_published} onCheckedChange={v => set("is_published", v)} />
            <Label>Tampilkan di direktori publik</Label>
          </div>
          <Button onClick={handleSubmit} disabled={upsertMutation.isPending || !form.company_name.trim()}>
            {upsertMutation.isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

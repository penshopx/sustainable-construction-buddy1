import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLkutReports, LkutReport } from "@/hooks/useLkutReports";
import { useLkutDocuments } from "@/hooks/useLkutDocuments";
import { LkutDocumentUpload } from "@/components/lkut/LkutDocumentUpload";
import { useAuth } from "@/hooks/useAuth";
import { exportLkutPdf } from "@/lib/lkutPdf";
import { GradingPanel } from "@/pages/PerformanceGrade";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Plus, FileText, CheckCircle2, Clock, Send, Trash2, AlertTriangle, Download, Paperclip, BarChart3 } from "lucide-react";

const currentYear = new Date().getFullYear();

function statusBadge(status: string) {
  switch (status) {
    case "submitted": return <Badge className="bg-accent/20 text-accent border-accent/30"><CheckCircle2 className="w-3 h-3 mr-1" /> Terkirim</Badge>;
    case "validated": return <Badge className="bg-primary/20 text-primary border-primary/30"><CheckCircle2 className="w-3 h-3 mr-1" /> Tervalidasi</Badge>;
    default: return <Badge variant="outline" className="text-muted-foreground"><Clock className="w-3 h-3 mr-1" /> Draft</Badge>;
  }
}

function calcCompleteness(r: LkutReport): number {
  let filled = 0;
  const total = 11;
  if (r.sbu_number) filled++;
  if (r.kta_number) filled++;
  if (r.tkk_replacement !== null) filled++;
  if (r.equipment_commitment_fulfilled !== null) filled++;
  if (r.smap_fulfilled !== null) filled++;
  if (r.experience_records_complete !== null) filled++;
  if (r.asset_value_current > 0) filled++;
  if (r.total_employees > 0) filled++;
  if (r.gcg_applied !== null) filled++;
  if (r.smk3_applied !== null) filled++;
  if (r.sales_value > 0) filled++;
  return Math.round((filled / total) * 100);
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);
}

export default function LkutReportPage() {
  const { reports, loading, createReport, updateReport, submitReport, deleteReport } = useLkutReports();
  const { profile } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(String(currentYear - 1));
  const [editReport, setEditReport] = useState<LkutReport | null>(null);
  const [form, setForm] = useState<Partial<LkutReport>>({});
  const [activeTab, setActiveTab] = useState("kepatuhan");
  const [mainTab, setMainTab] = useState("lkut");
  const { documents, uploading, uploadDocument, deleteDocument, getByComponent, acceptString, fetchDocs } = useLkutDocuments(editReport?.id);
  const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const existingYears = reports.map(r => r.report_year);
  const creatableYears = availableYears.filter(y => !existingYears.includes(y));

  useEffect(() => {
    if (creatableYears.length > 0 && !creatableYears.includes(Number(selectedYear))) {
      setSelectedYear(String(creatableYears[0]));
    }
  }, [creatableYears, selectedYear]);

  const handleCreate = async () => {
    const year = Number(selectedYear);
    if (!Number.isInteger(year) || !creatableYears.includes(year)) return;

    const result = await createReport(year);
    if (!result) return;
    setCreateOpen(false);
    setEditReport(result);
    setForm(result);
  };

  const openEdit = (r: LkutReport) => {
    setEditReport(r);
    setForm({ ...r });
    setActiveTab("kepatuhan");
  };

  const handleSave = async () => {
    if (!editReport) return;
    const success = await updateReport(editReport.id, form);
    if (success) {
      setEditReport(null);
    }
  };

  const handleSubmit = async () => {
    if (!editReport) return;
    await updateReport(editReport.id, form);
    const success = await submitReport(editReport.id);
    if (success) setEditReport(null);
  };

  return (
    <div className="space-y-6">
      {/* Top-level tabs: LKUT Data vs Grading */}
      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList className="w-full grid grid-cols-2 max-w-md">
          <TabsTrigger value="lkut" className="flex items-center gap-2">
            <FileText className="w-4 h-4" /> Laporan LKUT
          </TabsTrigger>
          <TabsTrigger value="grading" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Kinerja & Grading
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lkut">
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold font-heading text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6 text-accent" />
            Laporan Kegiatan Usaha Tahunan
          </h2>
          <p className="text-sm text-muted-foreground">
            Permen PUPR No. 7/2024 · Deadline: 30 April setiap tahun
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button asChild variant="outline">
            <Link to="/simulator-lkut">
              <FileText className="w-4 h-4 mr-2" /> Simulator Kesiapan LKUT
            </Link>
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Buat LKUT
          </Button>
        </div>
      </div>

      {/* Deadline reminder */}
      {new Date().getMonth() < 4 && (
        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-accent shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">Batas Waktu LKUT {currentYear - 1}</p>
              <p className="text-xs text-muted-foreground">
                Laporan tahun {currentYear - 1} wajib disampaikan paling lambat <strong>30 April {currentYear}</strong> melalui sistem informasi jasa konstruksi terintegrasi (Pasal 10 ayat 3).
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* LKUT Summary Stats */}
      {!loading && reports.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold font-heading text-foreground">{reports.length}</p>
            <p className="text-xs text-muted-foreground">Total Laporan</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold font-heading text-primary">{reports.filter(r => r.status === "submitted" || r.status === "validated").length}</p>
            <p className="text-xs text-muted-foreground">Terkirim</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold font-heading text-pub-emerald">{reports.filter(r => r.status === "validated").length}</p>
            <p className="text-xs text-muted-foreground">Tervalidasi</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold font-heading text-pub-amber">
              {Math.round(reports.reduce((s, r) => s + calcCompleteness(r), 0) / reports.length)}%
            </p>
            <p className="text-xs text-muted-foreground">Rata-rata Kelengkapan</p>
          </CardContent></Card>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Memuat data...</div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Belum ada laporan LKUT</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Buat laporan tahunan pertama Anda sesuai Permen PUPR No. 7/2024</p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Buat LKUT
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reports.map(r => {
            const completeness = calcCompleteness(r);
            return (
              <Card key={r.id} className="cursor-pointer hover:border-accent/50 transition-colors" onClick={() => openEdit(r)}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-heading">LKUT {r.report_year}</CardTitle>
                    {statusBadge(r.status)}
                  </div>
                  <CardDescription>
                    {r.sbu_number ? `SBU: ${r.sbu_number}` : "SBU belum diisi"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Kelengkapan</span>
                      <span className="font-medium">{completeness}%</span>
                    </div>
                    <Progress value={completeness} className="h-2" />
                  </div>
                  {r.submitted_at && (
                    <p className="text-xs text-muted-foreground mt-3">
                      Dikirim: {new Date(r.submitted_at).toLocaleDateString("id-ID")}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Buat LKUT Baru</DialogTitle></DialogHeader>
          <div>
            <Label>Tahun Laporan</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                  {creatableYears.length > 0 ? creatableYears.map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  )) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Semua tahun laporan sudah dibuat
                    </div>
                  )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
                Pilihan tahun mencakup lima tahun terakhir ({availableYears[availableYears.length - 1]}–{availableYears[0]}).
                Laporan tahun N disampaikan paling lambat 30 April tahun N+1
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Batal</Button>
              <Button onClick={handleCreate} disabled={creatableYears.length === 0}>Buat Laporan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editReport} onOpenChange={(open) => { if (!open) setEditReport(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent" />
              LKUT {editReport?.report_year}
              {editReport && statusBadge(editReport.status)}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="kepatuhan">Kepatuhan</TabsTrigger>
              <TabsTrigger value="keuangan">Keuangan & Org</TabsTrigger>
              <TabsTrigger value="sdm">SDM & Catatan</TabsTrigger>
              <TabsTrigger value="dokumen" className="flex items-center gap-1">
                <Paperclip className="w-3 h-3" /> Dokumen
                {documents.length > 0 && <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-1">{documents.length}</Badge>}
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Kepatuhan Perizinan */}
            <TabsContent value="kepatuhan" className="space-y-5 mt-4">
              <div>
                <h3 className="font-heading font-semibold text-foreground mb-3">A. Data Kepatuhan Perizinan</h3>
                <p className="text-xs text-muted-foreground mb-4">Sesuai Lampiran Permen PUPR No. 7/2024 Bagian A.1</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nomor SBU</Label>
                  <Input value={form.sbu_number || ""} onChange={e => setForm({ ...form, sbu_number: e.target.value })} placeholder="Contoh: SBU-2024-BG001-12345" />
                </div>
                <div>
                  <Label>Tipe SBU</Label>
                  <Select value={form.sbu_type || "baru"} onValueChange={v => setForm({ ...form, sbu_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baru">SBU Baru</SelectItem>
                      <SelectItem value="perpanjangan">SBU Perpanjangan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Tanggal Kadaluarsa SBU</Label>
                <Input type="date" value={form.sbu_expiry_date || ""} onChange={e => setForm({ ...form, sbu_expiry_date: e.target.value })} />
              </div>

              <Separator />

              <h4 className="font-heading font-semibold text-foreground text-sm">Keanggotaan Asosiasi (KTA)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nama Asosiasi</Label>
                  <Input value={form.kta_association || ""} onChange={e => setForm({ ...form, kta_association: e.target.value })} placeholder="Contoh: GAPENSI, AKI, ASPEKINDO" />
                </div>
                <div>
                  <Label>Nomor KTA</Label>
                  <Input value={form.kta_number || ""} onChange={e => setForm({ ...form, kta_number: e.target.value })} placeholder="Contoh: KTA-2024-DKI-00567" />
                </div>
              </div>
              <div>
                <Label>Masa Berlaku KTA</Label>
                <Input type="date" value={form.kta_expiry_date || ""} onChange={e => setForm({ ...form, kta_expiry_date: e.target.value })} />
              </div>
              <LkutDocumentUpload
                component="kepatuhan_kta"
                label="Keanggotaan Asosiasi (KTA)"
                documents={getByComponent("kepatuhan_kta")}
                uploading={uploading}
                acceptString={acceptString}
                onUpload={uploadDocument}
                onDelete={deleteDocument}
                disabled={editReport?.status !== "draft"}
              />

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Penggantian TKK (PJBU/PJTBU/PJSKBU)</Label>
                  <p className="text-xs text-muted-foreground">Adakah penggantian Tenaga Kerja Konstruksi pada tahun ini?</p>
                </div>
                <Switch checked={form.tkk_replacement || false} onCheckedChange={v => setForm({ ...form, tkk_replacement: v })} />
              </div>
              {form.tkk_replacement && (
                <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-accent/30">
                  <div>
                    <Label>Tanggal Penggantian</Label>
                    <Input type="date" value={form.tkk_replacement_date || ""} onChange={e => setForm({ ...form, tkk_replacement_date: e.target.value })} />
                  </div>
                  <div>
                    <Label>Keterangan</Label>
                    <Input value={form.tkk_replacement_notes || ""} onChange={e => setForm({ ...form, tkk_replacement_notes: e.target.value })} placeholder="Contoh: PJBU diganti dari Ir. Ahmad ke Ir. Budi per SK No. 05/2024" />
                  </div>
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Pemenuhan Komitmen Peralatan Utama</Label>
                  <p className="text-xs text-muted-foreground">Apakah telah memenuhi komitmen penyediaan peralatan utama?</p>
                </div>
                <Switch checked={form.equipment_commitment_fulfilled || false} onCheckedChange={v => setForm({ ...form, equipment_commitment_fulfilled: v })} />
              </div>
              {form.equipment_commitment_fulfilled && (
                <div className="pl-4 border-l-2 border-accent/30">
                  <Label>Tanggal Pemenuhan</Label>
                  <Input type="date" value={form.equipment_fulfillment_date || ""} onChange={e => setForm({ ...form, equipment_fulfillment_date: e.target.value })} />
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Pelaksanaan SMAP</Label>
                  <p className="text-xs text-muted-foreground">Apakah telah memenuhi komitmen Sistem Manajemen Anti Penyuapan?</p>
                </div>
                <Switch checked={form.smap_fulfilled || false} onCheckedChange={v => setForm({ ...form, smap_fulfilled: v })} />
              </div>
              {form.smap_fulfilled && (
                <div className="pl-4 border-l-2 border-accent/30">
                  <Label>Tanggal Pelaporan SMAP</Label>
                  <Input type="date" value={form.smap_report_date || ""} onChange={e => setForm({ ...form, smap_report_date: e.target.value })} />
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Pencatatan Pengalaman di SIJKT</Label>
                  <p className="text-xs text-muted-foreground">Apakah semua proyek sudah dicatatkan di SIJKT?</p>
                </div>
                <Switch checked={form.experience_records_complete || false} onCheckedChange={v => setForm({ ...form, experience_records_complete: v })} />
              </div>
              {!form.experience_records_complete && (
                <div className="pl-4 border-l-2 border-accent/30">
                  <Label>Daftar Pengalaman yang Belum Dicatatkan</Label>
                  <Textarea value={form.experience_pending_list || ""} onChange={e => setForm({ ...form, experience_pending_list: e.target.value })} placeholder="Contoh:&#10;1. Pembangunan Gedung Kantor PT ABC (2023) - Rp 15M&#10;2. Renovasi Pabrik XYZ Cikarang (2023) - Rp 8M&#10;3. Jalan Akses Kawasan Industri Bekasi (2024) - Rp 22M" />
                </div>
              )}

              <Separator />
              <LkutDocumentUpload
                component="kepatuhan_sbu"
                label="SBU & Perizinan"
                documents={getByComponent("kepatuhan_sbu")}
                uploading={uploading}
                acceptString={acceptString}
                onUpload={uploadDocument}
                onDelete={deleteDocument}
                disabled={editReport?.status !== "draft"}
              />
              <LkutDocumentUpload
                component="kepatuhan_tkk"
                label="Penggantian TKK"
                documents={getByComponent("kepatuhan_tkk")}
                uploading={uploading}
                acceptString={acceptString}
                onUpload={uploadDocument}
                onDelete={deleteDocument}
                disabled={editReport?.status !== "draft"}
              />
              <LkutDocumentUpload
                component="kepatuhan_peralatan"
                label="Komitmen Peralatan"
                documents={getByComponent("kepatuhan_peralatan")}
                uploading={uploading}
                acceptString={acceptString}
                onUpload={uploadDocument}
                onDelete={deleteDocument}
                disabled={editReport?.status !== "draft"}
              />
              <LkutDocumentUpload
                component="kepatuhan_smap"
                label="SMAP"
                documents={getByComponent("kepatuhan_smap")}
                uploading={uploading}
                acceptString={acceptString}
                onUpload={uploadDocument}
                onDelete={deleteDocument}
                disabled={editReport?.status !== "draft"}
              />
            </TabsContent>

            {/* Tab 2: Keuangan & Organisasi */}
            <TabsContent value="keuangan" className="space-y-5 mt-4">
              <div>
                <h3 className="font-heading font-semibold text-foreground mb-3">B. Data Keuangan Perusahaan</h3>
                <p className="text-xs text-muted-foreground mb-4">Sesuai Lampiran Permen PUPR No. 7/2024 Bagian A.2</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nilai Aset Tahun N (Rp)</Label>
                  <Input type="number" value={form.asset_value_current || 0} onChange={e => setForm({ ...form, asset_value_current: Number(e.target.value) })} placeholder="Contoh: 25000000000" />
                  <p className="text-xs text-muted-foreground mt-0.5">Contoh: Rp 25 Miliar</p>
                </div>
                <div>
                  <Label>Nilai Aset Tahun N-1 (Rp)</Label>
                  <Input type="number" value={form.asset_value_previous || 0} onChange={e => setForm({ ...form, asset_value_previous: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Nilai Penjualan/Total Proyek (Rp)</Label>
                  <Input type="number" value={form.sales_value || 0} onChange={e => setForm({ ...form, sales_value: Number(e.target.value) })} placeholder="Contoh: 50000000000" />
                  <p className="text-xs text-muted-foreground mt-0.5">Total nilai kontrak proyek tahun ini</p>
                </div>
                <div>
                  <Label>Laba Kotor (Rp)</Label>
                  <Input type="number" value={form.gross_profit || 0} onChange={e => setForm({ ...form, gross_profit: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Aset Lancar (Rp)</Label>
                  <Input type="number" value={form.current_assets || 0} onChange={e => setForm({ ...form, current_assets: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Kewajiban Jangka Pendek (Rp)</Label>
                  <Input type="number" value={form.short_term_liabilities || 0} onChange={e => setForm({ ...form, short_term_liabilities: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Total Kewajiban (Rp)</Label>
                  <Input type="number" value={form.total_liabilities || 0} onChange={e => setForm({ ...form, total_liabilities: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Total Ekuitas (Rp)</Label>
                  <Input type="number" value={form.total_equity || 0} onChange={e => setForm({ ...form, total_equity: Number(e.target.value) })} />
                </div>
              </div>

              {/* Quick financial ratios */}
              {(form.current_assets || 0) > 0 && (form.short_term_liabilities || 0) > 0 && (
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <p className="text-xs font-heading font-semibold text-foreground mb-2">Rasio Keuangan Otomatis</p>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Current Ratio</p>
                        <p className="font-semibold">{((form.current_assets || 0) / (form.short_term_liabilities || 1)).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Debt-to-Equity</p>
                        <p className="font-semibold">{((form.total_liabilities || 0) / (form.total_equity || 1)).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Profit Margin</p>
                        <p className="font-semibold">{(form.sales_value || 0) > 0 ? (((form.gross_profit || 0) / (form.sales_value || 1)) * 100).toFixed(1) + "%" : "-"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Separator />

              <h3 className="font-heading font-semibold text-foreground">Data Kesehatan Organisasi</h3>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Penerapan Good Corporate Governance (GCG)</Label>
                  <p className="text-xs text-muted-foreground">Apakah perusahaan menerapkan prinsip tata kelola yang baik?</p>
                </div>
                <Switch checked={form.gcg_applied || false} onCheckedChange={v => setForm({ ...form, gcg_applied: v })} />
              </div>
              {form.gcg_applied && (
                <div className="pl-4 border-l-2 border-accent/30">
                  <Label>Tahun Pertama Penerapan GCG</Label>
                  <Input type="number" value={form.gcg_first_year || ""} onChange={e => setForm({ ...form, gcg_first_year: Number(e.target.value) })} placeholder="cth: 2020" />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <Label>Penerapan SMK3</Label>
                  <p className="text-xs text-muted-foreground">Sistem Manajemen Keselamatan dan Kesehatan Kerja</p>
                </div>
                <Switch checked={form.smk3_applied || false} onCheckedChange={v => setForm({ ...form, smk3_applied: v })} />
              </div>
              {form.smk3_applied && (
                <div className="pl-4 border-l-2 border-accent/30">
                  <Label>Tahun Pertama Penerapan SMK3</Label>
                  <Input type="number" value={form.smk3_first_year || ""} onChange={e => setForm({ ...form, smk3_first_year: Number(e.target.value) })} placeholder="cth: 2021" />
                </div>
              )}

              <div>
                <Label>Sertifikasi Nasional/Internasional</Label>
                <Textarea value={form.certifications || ""} onChange={e => setForm({ ...form, certifications: e.target.value })} placeholder="ISO 9001, ISO 14001, dll. (satu per baris)" rows={3} />
              </div>

              <div>
                <Label>Penghargaan Keunggulan Perusahaan</Label>
                <Textarea value={form.awards || ""} onChange={e => setForm({ ...form, awards: e.target.value })} placeholder="Daftar penghargaan (satu per baris)" rows={3} />
              </div>

              <Separator />
              <LkutDocumentUpload
                component="keuangan_laporan"
                label="Laporan Keuangan"
                documents={getByComponent("keuangan_laporan")}
                uploading={uploading}
                acceptString={acceptString}
                onUpload={uploadDocument}
                onDelete={deleteDocument}
                disabled={editReport?.status !== "draft"}
              />
              <LkutDocumentUpload
                component="keuangan_gcg"
                label="GCG & Sertifikasi"
                documents={getByComponent("keuangan_gcg")}
                uploading={uploading}
                acceptString={acceptString}
                onUpload={uploadDocument}
                onDelete={deleteDocument}
                disabled={editReport?.status !== "draft"}
              />
            </TabsContent>
            {/* Tab 3: SDM & Catatan */}
            <TabsContent value="sdm" className="space-y-5 mt-4">
              <div>
                <h3 className="font-heading font-semibold text-foreground mb-3">Data Sumber Daya Manusia</h3>
                <p className="text-xs text-muted-foreground mb-4">Sesuai Lampiran Permen PUPR No. 7/2024</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Total Karyawan (Tetap + Kontrak)</Label>
                  <Input type="number" value={form.total_employees || 0} onChange={e => setForm({ ...form, total_employees: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Total Karyawan Terlatih</Label>
                  <Input type="number" value={form.trained_employees || 0} onChange={e => setForm({ ...form, trained_employees: Number(e.target.value) })} />
                  <p className="text-xs text-muted-foreground mt-1">Yang pernah mengikuti pelatihan min. 3 hari</p>
                </div>
                <div>
                  <Label>Tenaga Ahli Tetap</Label>
                  <Input type="number" value={form.permanent_experts || 0} onChange={e => setForm({ ...form, permanent_experts: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Tenaga Ahli Kontrak</Label>
                  <Input type="number" value={form.contract_experts || 0} onChange={e => setForm({ ...form, contract_experts: Number(e.target.value) })} />
                </div>
              </div>

              {(form.total_employees || 0) > 0 && (
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <p className="text-xs font-heading font-semibold text-foreground mb-2">Rasio SDM</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">% Karyawan Terlatih</p>
                        <p className="font-semibold">{(((form.trained_employees || 0) / (form.total_employees || 1)) * 100).toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Rasio Ahli Tetap vs Kontrak</p>
                        <p className="font-semibold">{form.permanent_experts || 0} : {form.contract_experts || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Separator />

              <div>
                <Label>Catatan Tambahan</Label>
                <Textarea value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Catatan atau keterangan tambahan untuk laporan ini" rows={4} />
              </div>

              <Separator />
              <LkutDocumentUpload
                component="sdm_data"
                label="Data SDM & Pelatihan"
                documents={getByComponent("sdm_data")}
                uploading={uploading}
                acceptString={acceptString}
                onUpload={uploadDocument}
                onDelete={deleteDocument}
                disabled={editReport?.status !== "draft"}
              />
            </TabsContent>

            {/* Tab 4: Dokumen (Summary) */}
            <TabsContent value="dokumen" className="space-y-5 mt-4">
              <div>
                <h3 className="font-heading font-semibold text-foreground mb-1">Ringkasan Dokumen Pendukung</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Seluruh dokumen bukti yang telah dilampirkan untuk mendukung laporan LKUT ini.
                  Anda juga dapat upload dokumen dari masing-masing tab Kepatuhan, Keuangan, dan SDM.
                </p>
              </div>

              {documents.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Paperclip className="w-10 h-10 mx-auto opacity-30 mb-3" />
                    <p className="text-sm">Belum ada dokumen pendukung yang diunggah</p>
                    <p className="text-xs mt-1">Upload dokumen dari tab Kepatuhan, Keuangan & Org, atau SDM</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {[
                    { key: "kepatuhan_sbu", label: "SBU & Perizinan" },
                    { key: "kepatuhan_tkk", label: "Penggantian TKK" },
                    { key: "kepatuhan_peralatan", label: "Komitmen Peralatan" },
                    { key: "kepatuhan_smap", label: "SMAP" },
                    { key: "kepatuhan_kta", label: "Keanggotaan Asosiasi (KTA)" },
                    { key: "keuangan_laporan", label: "Laporan Keuangan" },
                    { key: "keuangan_gcg", label: "GCG & Sertifikasi" },
                    { key: "sdm_data", label: "Data SDM & Pelatihan" },
                  ].map(({ key, label }) => {
                    const docs = getByComponent(key);
                    if (docs.length === 0) return null;
                    return (
                      <LkutDocumentUpload
                        key={key}
                        component={key}
                        label={label}
                        documents={docs}
                        uploading={uploading}
                        acceptString={acceptString}
                        onUpload={uploadDocument}
                        onDelete={deleteDocument}
                        disabled={editReport?.status !== "draft"}
                      />
                    );
                  })}
                </>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {editReport?.status === "draft" && (
              <Button variant="ghost" size="sm" className="text-destructive mr-auto" onClick={async () => { await deleteReport(editReport.id); setEditReport(null); }}>
                <Trash2 className="w-4 h-4 mr-1" /> Hapus
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (editReport) {
                  exportLkutPdf(editReport, profile ? { full_name: profile.full_name, company: profile.company } : undefined);
                }
              }}
            >
              <Download className="w-4 h-4 mr-1" /> Export PDF
            </Button>
            <Button variant="outline" onClick={() => setEditReport(null)}>Tutup</Button>
            {editReport?.status === "draft" && (
              <>
                <Button variant="secondary" onClick={handleSave}>Simpan Draft</Button>
                <Button onClick={handleSubmit}>
                  <Send className="w-4 h-4 mr-2" /> Kirim LKUT
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
        </TabsContent>

        <TabsContent value="grading">
          <GradingPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

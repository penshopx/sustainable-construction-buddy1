import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Leaf, Timer, Database, Box, Cpu, Recycle, ShieldCheck, Lightbulb, ChevronRight, Send, ArrowLeft, CheckCircle2, FileText, Trash2, Search, X, Paperclip, Upload, Wrench, AppWindow, Package, Target, BarChart, Users, Link2, ExternalLink } from "lucide-react";
import { MiniAppGrid } from "@/components/innovation/MiniAppLauncher";
import { findTemplate, type ToolboxTemplate } from "@/components/innovation/toolboxTemplates";
import ToolboxViewer from "@/components/innovation/ToolboxViewer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useInnovationCategories, useInnovationProposals, useCreateProposal, useDeleteProposal, type InnovationCategory } from "@/hooks/useInnovations";
import { toast } from "@/components/ui/sonner-toast";

const iconMap: Record<string, React.ElementType> = {
  Leaf, Timer, Database, Box, Cpu, Recycle, ShieldCheck, Lightbulb, Target, BarChart, Users, Link2,
};

const stageLabels: Record<number, { label: string; color: string }> = {
  1: { label: "Tahap 1: Tender & Perencanaan", color: "bg-pub-sky/15 text-pub-sky" },
  2: { label: "Tahap 2: Pelaksanaan & Pengendalian", color: "bg-pub-amber/15 text-pub-amber" },
  3: { label: "Tahap 3: Strategis & Keberlanjutan", color: "bg-pub-emerald/15 text-pub-emerald" },
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-pub-amber/15 text-pub-amber",
  reviewed: "bg-pub-sky/15 text-pub-sky",
  approved: "bg-pub-emerald/15 text-pub-emerald",
  rejected: "bg-destructive/15 text-destructive",
};

function CategoryDetail({ category, onBack }: { category: InnovationCategory; onBack: () => void }) {
  const Icon = iconMap[category.icon] || Lightbulb;
  const stage = stageLabels[category.stage];
  const [activeTemplate, setActiveTemplate] = useState<ToolboxTemplate | null>(null);

  // Parse concepts into toolkit/toolbox/miniapp groups
  const toolkits = category.concepts.filter(c => c.startsWith('🧰'));
  const toolboxes = category.concepts.filter(c => c.startsWith('📦'));
  const miniApps = category.concepts.filter(c => c.startsWith('📱'));
  const ungrouped = category.concepts.filter(c => !c.startsWith('🧰') && !c.startsWith('📦') && !c.startsWith('📱'));

  const parseItem = (item: string) => {
    const cleaned = item.replace(/^(🧰 TOOLKIT: |📦 TOOLBOX: |📱 MINI APP: )/, '');
    const dashIdx = cleaned.indexOf(' — ');
    if (dashIdx > 0) {
      return { title: cleaned.slice(0, dashIdx), desc: cleaned.slice(dashIdx + 3) };
    }
    return { title: cleaned, desc: '' };
  };

  const sections = [
    { items: miniApps, label: 'Mini Apps', subtitle: 'Alat Hitung & Dashboard Interaktif', icon: AppWindow, color: 'text-pub-emerald', bgColor: 'bg-pub-emerald/5', borderColor: 'border-pub-emerald/20', badgeColor: 'bg-pub-emerald/15 text-pub-emerald' },
    { items: toolboxes, label: 'Toolbox', subtitle: 'Template & Checklist Operasional', icon: Package, color: 'text-pub-sky', bgColor: 'bg-pub-sky/5', borderColor: 'border-pub-sky/20', badgeColor: 'bg-pub-sky/15 text-pub-sky' },
    { items: toolkits, label: 'Toolkit', subtitle: 'Sistem Terpadu', icon: Wrench, color: 'text-pub-amber', bgColor: 'bg-pub-amber/5', borderColor: 'border-pub-amber/20', badgeColor: 'bg-pub-amber/15 text-pub-amber' },
  ];

  const totalTools = miniApps.length + toolboxes.length + toolkits.length + ungrouped.length;

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
      <Button variant="ghost" onClick={onBack} className="mb-4 gap-2">
        <ArrowLeft className="w-4 h-4" /> Kembali ke Katalog
      </Button>

      {/* Header Card */}
      <Card className="mb-8 overflow-hidden border-none shadow-lg">
        <div className="bg-gradient-to-br from-pub-navy via-pub-navy to-pub-navy-light p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <Icon className="w-7 h-7 text-pub-amber" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h2 className="text-2xl font-bold font-heading text-white">{category.name}</h2>
                <Badge className={stage.color + " text-xs"}>{stage.label}</Badge>
              </div>
              <p className="text-white/70 text-sm md:text-base leading-relaxed">{category.description}</p>
              <div className="flex items-center gap-4 mt-4 text-xs text-white/50">
                <span className="flex items-center gap-1"><AppWindow className="w-3.5 h-3.5" /> {miniApps.length} mini app</span>
                <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" /> {toolboxes.length} toolbox</span>
                {toolkits.length > 0 && <span className="flex items-center gap-1"><Wrench className="w-3.5 h-3.5" /> {toolkits.length} toolkit</span>}
                <span className="font-medium text-pub-amber">{totalTools} alat total</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Sections */}
      <div className="space-y-8 mb-8">
        {sections.map((section, sIdx) => {
          if (section.items.length === 0) return null;
          const SectionIcon = section.icon;
          return (
            <motion.div key={section.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: sIdx * 0.1 }}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-9 h-9 rounded-lg ${section.bgColor} flex items-center justify-center`}>
                  <SectionIcon className={`w-5 h-5 ${section.color}`} />
                </div>
                <div>
                  <h3 className="text-base font-bold font-heading">{section.label}</h3>
                  <p className="text-xs text-muted-foreground">{section.subtitle}</p>
                </div>
                <Badge className={`ml-auto ${section.badgeColor} text-xs`}>{section.items.length} item</Badge>
              </div>
              <div className="grid gap-4">
                {section.items.map((item, i) => {
                  const parsed = parseItem(item);
                  const template = (section.label === "Toolbox" || section.label === "Toolkit") ? findTemplate(parsed.title) : undefined;
                  const isClickable = !!template;
                  return (
                    <Card
                      key={i}
                      className={`border ${section.borderColor} hover:shadow-card-hover transition-all group ${isClickable ? "cursor-pointer" : ""}`}
                      onClick={isClickable ? () => setActiveTemplate(template) : undefined}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg ${section.bgColor} flex items-center justify-center shrink-0 mt-0.5`}>
                            <SectionIcon className={`w-4 h-4 ${section.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground mb-1.5">{parsed.title}</p>
                            {parsed.desc && <p className="text-xs text-muted-foreground leading-relaxed">{parsed.desc}</p>}
                          </div>
                          {isClickable && (
                            <Button variant="outline" size="sm" className={`shrink-0 text-xs gap-1 ${section.color} border-current/30 hover:bg-current/10 opacity-0 group-hover:opacity-100 transition-opacity`}>
                              Buka Template
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </motion.div>
          );
        })}

        {ungrouped.length > 0 && (
          <div>
            <h3 className="text-base font-bold font-heading mb-3 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-pub-amber" /> Konsep & Ruang Inovasi
            </h3>
            <ul className="space-y-2">
              {ungrouped.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-pub-amber shrink-0" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Interactive Mini Apps */}
      <MiniAppGrid categorySlug={category.slug} />

      {/* Programs & Benefits */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-pub-sky/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-pub-sky" /> Program PUB Terkait
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {category.programs.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-pub-sky shrink-0" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-pub-emerald/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-pub-emerald" /> Manfaat & Dampak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {category.benefits.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-pub-emerald shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Toolbox/Toolkit Viewer */}
      {activeTemplate && (
        <ToolboxViewer
          template={activeTemplate}
          open={!!activeTemplate}
          onOpenChange={(open) => { if (!open) setActiveTemplate(null); }}
        />
      )}
    </motion.div>
  );
}

function ProposalForm({ categories, onClose }: { categories: InnovationCategory[]; onClose: () => void }) {
  const { user } = useAuth();
  const createProposal = useCreateProposal();
  const [form, setForm] = useState({ category_id: "", title: "", description: "", scope: "", expected_impact: "" });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.category_id || !form.title) {
      toast.error("Judul dan kategori wajib diisi");
      return;
    }

    let attachment_url = "";
    let attachment_name = "";

    if (file && user) {
      setUploading(true);
      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("innovation-attachments")
        .upload(filePath, file);
      setUploading(false);
      if (uploadError) {
        toast.error("Gagal mengunggah lampiran: " + uploadError.message);
        return;
      }
      attachment_url = filePath;
      attachment_name = file.name;
    }

    try {
      await createProposal.mutateAsync({ ...form, attachment_url, attachment_name });
      toast.success("Proposal inovasi berhasil disimpan");
      onClose();
    } catch {
      toast.error("Gagal menyimpan proposal");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Kategori Inovasi</Label>
        <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
          <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Judul Proposal</Label>
        <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Contoh: Implementasi BIM untuk Efisiensi Koordinasi Multi-Disiplin" maxLength={200} />
      </div>
      <div>
        <Label>Deskripsi</Label>
        <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Contoh: Mengadopsi Building Information Modeling (BIM) Level 2 untuk seluruh proyek gedung di atas Rp 50M. Diharapkan dapat mengurangi rework sebesar 30% dan meningkatkan akurasi estimasi biaya hingga 95%." rows={3} maxLength={2000} />
      </div>
      <div>
        <Label>Lingkup Penerapan</Label>
        <Input value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} placeholder="Contoh: Seluruh proyek gedung bertingkat perusahaan di Jawa & Sumatera" maxLength={200} />
      </div>
      <div>
        <Label>Dampak yang Diharapkan</Label>
        <Textarea value={form.expected_impact} onChange={(e) => setForm({ ...form, expected_impact: e.target.value })} placeholder="Contoh: Pengurangan rework 30%, penghematan biaya material 15%, percepatan jadwal proyek 10%, dan peningkatan skor kinerja BUJK dari grade B ke A." rows={2} maxLength={1000} />
      </div>
      <div>
        <Label>Lampiran (opsional)</Label>
        <div className="mt-1">
          {file ? (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted text-sm">
              <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate">{file.name}</span>
              <button type="button" onClick={() => setFile(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-muted-foreground/30 cursor-pointer hover:border-muted-foreground/60 transition-colors text-sm text-muted-foreground">
              <Upload className="w-4 h-4" />
              <span>Pilih file (PDF, DOC, gambar, max 10MB)</span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && f.size > 10 * 1024 * 1024) {
                    toast.error("Ukuran file maksimal 10MB");
                    return;
                  }
                  if (f) setFile(f);
                }}
              />
            </label>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
        <Button type="submit" disabled={createProposal.isPending || uploading} className="gap-2">
          <Send className="w-4 h-4" /> {uploading ? "Mengunggah..." : createProposal.isPending ? "Menyimpan..." : "Kirim Proposal"}
        </Button>
      </div>
    </form>
  );
}

export default function Innovation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: categories = [], isLoading } = useInnovationCategories();
  const { data: proposals = [] } = useInnovationProposals();
  const deleteProposal = useDeleteProposal();
  const [selectedCategory, setSelectedCategory] = useState<InnovationCategory | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<number | null>(null);

  const filteredCategories = useMemo(() => {
    let result = categories;
    if (stageFilter) result = result.filter((c) => c.stage === stageFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.concepts.some((x) => x.toLowerCase().includes(q)) ||
          c.programs.some((x) => x.toLowerCase().includes(q))
      );
    }
    return result;
  }, [categories, search, stageFilter]);

  const roadmapStages = [
    { stage: 1, title: "Strategi, Keuangan & Perencanaan", items: ["Tender Intelligence", "Financial Control", "Planning Excellence"] },
    { stage: 2, title: "Pelaksanaan, SDM & Keamanan", items: ["Execution Control", "Supply Chain", "Human Capital", "Risk Security"] },
    { stage: 3, title: "Teknologi, ESG & Keberlanjutan", items: ["Digital Transformation", "Environmental ESG", "Post-Project"] },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-pub-navy via-pub-navy to-pub-navy-light py-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-primary-foreground/70 hover:text-primary-foreground gap-1">
              <ArrowLeft className="w-4 h-4" /> Beranda
            </Button>
          </div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-3xl md:text-5xl font-extrabold font-heading text-primary-foreground mb-4">
            Inovasi PUB <span className="text-gradient-hero">Risk Control</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-primary-foreground/70 text-lg max-w-2xl mb-6">
            Highly Critical & Rare Toolkit System untuk BUJK Kontraktor — dari Tender hingga Pasca Proyek, kendalikan risiko dengan sistem yang jarang dimiliki kompetitor.
          </motion.p>

          {/* Roadmap mini */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex flex-wrap gap-4 mt-8">
            {roadmapStages.map((s) => (
              <div key={s.stage} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary-foreground/5 border border-primary-foreground/10">
                <div className="w-8 h-8 rounded-full bg-pub-amber/20 flex items-center justify-center text-pub-amber font-bold text-sm">{s.stage}</div>
                <div>
                  <p className="text-primary-foreground text-sm font-semibold">{s.title}</p>
                  <p className="text-primary-foreground/50 text-xs">{s.items.join(" · ")}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Content */}
      <section className="container mx-auto max-w-6xl px-6 py-12">
        <Tabs defaultValue="katalog">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <TabsList>
              <TabsTrigger value="katalog">Katalog Inovasi</TabsTrigger>
              {user && <TabsTrigger value="proposals">Proposal Saya</TabsTrigger>}
            </TabsList>
            {user && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2"><Send className="w-4 h-4" /> Ajukan Proposal</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Ajukan Proposal Inovasi</DialogTitle>
                  </DialogHeader>
                  <ProposalForm categories={categories} onClose={() => setDialogOpen(false)} />
                </DialogContent>
              </Dialog>
            )}
          </div>

          <TabsContent value="katalog">
            {selectedCategory ? (
              <CategoryDetail category={selectedCategory} onBack={() => setSelectedCategory(null)} />
            ) : isLoading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="animate-pulse h-48" />
                ))}
              </div>
            ) : (
              <div className="space-y-8">
                {/* Search & Filter */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Cari kategori, konsep, atau program..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 pr-9"
                    />
                    {search && (
                      <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={stageFilter === null ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStageFilter(null)}
                    >
                      Semua
                    </Button>
                    {[1, 2, 3].map((s) => (
                      <Button
                        key={s}
                        variant={stageFilter === s ? "default" : "outline"}
                        size="sm"
                        onClick={() => setStageFilter(stageFilter === s ? null : s)}
                      >
                        Tahap {s}
                      </Button>
                    ))}
                  </div>
                </div>

                {filteredCategories.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-muted-foreground">Tidak ada kategori yang cocok dengan pencarian "{search}"</p>
                  </Card>
                ) : (
                  [1, 2, 3].map((stageNum) => {
                    const stageCats = filteredCategories.filter((c) => c.stage === stageNum);
                    if (stageCats.length === 0) return null;
                    const stage = stageLabels[stageNum];
                    return (
                      <motion.section key={stageNum} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-8 h-8 rounded-full bg-pub-amber/20 flex items-center justify-center text-pub-amber font-bold text-sm">{stageNum}</div>
                          <div>
                            <h3 className="text-lg font-bold font-heading">{stage.label}</h3>
                            <p className="text-xs text-muted-foreground">{stageCats.length} kategori inovasi</p>
                          </div>
                        </div>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                          {stageCats.map((cat, i) => {
                            const Icon = iconMap[cat.icon] || Lightbulb;
                            return (
                              <motion.div key={cat.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                                <Card
                                  className="cursor-pointer hover:shadow-card-hover transition-all duration-200 group h-full"
                                  onClick={() => setSelectedCategory(cat)}
                                >
                                  <CardHeader>
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="w-10 h-10 rounded-lg bg-accent/15 flex items-center justify-center group-hover:bg-accent/25 transition-colors">
                                        <Icon className="w-5 h-5 text-accent" />
                                      </div>
                                      <Badge variant="outline" className={stage.color + " text-xs"}>
                                        Tahap {cat.stage}
                                      </Badge>
                                    </div>
                                    <CardTitle className="text-base">{cat.name}</CardTitle>
                                    <CardDescription className="line-clamp-2">{cat.description}</CardDescription>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="flex items-center text-xs text-muted-foreground gap-1.5 flex-wrap">
                                      {cat.concepts.filter(c => c.startsWith('📱')).length > 0 && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-pub-emerald/10 text-pub-emerald">
                                          <AppWindow className="w-3 h-3" />{cat.concepts.filter(c => c.startsWith('📱')).length} mini app
                                        </span>
                                      )}
                                      {cat.concepts.filter(c => c.startsWith('📦')).length > 0 && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-pub-sky/10 text-pub-sky">
                                          <Package className="w-3 h-3" />{cat.concepts.filter(c => c.startsWith('📦')).length} toolbox
                                        </span>
                                      )}
                                      {cat.concepts.filter(c => c.startsWith('🧰')).length > 0 && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-pub-amber/10 text-pub-amber">
                                          <Wrench className="w-3 h-3" />{cat.concepts.filter(c => c.startsWith('🧰')).length} toolkit
                                        </span>
                                      )}
                                      <ChevronRight className="w-3 h-3 ml-auto group-hover:translate-x-1 transition-transform" />
                                    </div>
                                  </CardContent>
                                </Card>
                              </motion.div>
                            );
                          })}
                        </div>
                      </motion.section>
                    );
                  })
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="proposals">
            {!user ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Silakan login untuk melihat proposal Anda.</p>
                <Button className="mt-4" onClick={() => navigate("/auth")}>Login</Button>
              </Card>
            ) : proposals.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground mb-4">Belum ada proposal inovasi.</p>
                <Button onClick={() => setDialogOpen(true)} className="gap-2">
                  <Send className="w-4 h-4" /> Ajukan Proposal Pertama
                </Button>
              </Card>
            ) : (
              <div className="space-y-4">
                {proposals.map((p) => (
                  <Card key={p.id} className="cursor-pointer hover:shadow-card-hover transition-all" onClick={() => navigate(`/inovasi/proposal/${p.id}`)}>
                    <CardContent className="flex items-start justify-between gap-4 pt-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{p.title}</h3>
                          <Badge className={statusColors[p.status] || ""}>{p.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>
                        {p.innovation_categories && (
                          <p className="text-xs text-muted-foreground mt-1">Kategori: {p.innovation_categories.name}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {p.attachment_name && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Paperclip className="w-3 h-3" /> {p.attachment_name}
                            </span>
                          )}
                        </div>
                        {p.admin_notes && (
                          <p className="text-xs mt-2 p-2 rounded bg-muted">Catatan admin: {p.admin_notes}</p>
                        )}
                      </div>
                      {p.status === "draft" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            deleteProposal.mutate(p.id, {
                              onSuccess: () => toast.success("Proposal dihapus"),
                            });
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}

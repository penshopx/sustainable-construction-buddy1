import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { toast } from "@/components/ui/sonner-toast";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import html2pdf from "html2pdf.js";
import {
  FileText, Loader2, Download, Copy, CheckCircle2,
  ClipboardCheck, DollarSign, Shield, AlertTriangle, BarChart3,
  FolderKanban, Database, ChevronRight, Zap, FileDown
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";

const documentTypes = [
  { id: "risk_plan", name: "Risk Management Plan", shortName: "Risk Plan", icon: AlertTriangle, color: "text-pub-violet", bg: "bg-pub-violet/10", description: "Rencana manajemen risiko berbasis risk register", autoFill: ["project", "risks"] },
  { id: "rab", name: "Rencana Anggaran Biaya", shortName: "RAB", icon: DollarSign, color: "text-pub-emerald", bg: "bg-pub-emerald/10", description: "RAB berbasis data budget tracker", autoFill: ["project", "budget"] },
  { id: "rkk", name: "Rencana Keselamatan Konstruksi", shortName: "RKK", icon: Shield, color: "text-pub-amber", bg: "bg-pub-amber/10", description: "Dokumen K3 proyek", autoFill: ["project", "risks"] },
  { id: "laporan_proyek", name: "Laporan Progress Proyek", shortName: "Laporan", icon: BarChart3, color: "text-pub-sky", bg: "bg-pub-sky/10", description: "Laporan lengkap dengan data proyek", autoFill: ["project", "risks", "budget"] },
  { id: "sop", name: "Standard Operating Procedure", shortName: "SOP", icon: ClipboardCheck, color: "text-destructive", bg: "bg-destructive/10", description: "SOP proses bisnis BUJK", autoFill: ["project"] },
];

const Generator = () => {
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [context, setContext] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  // Auto-fill state
  const [projects, setProjects] = useState<Tables<"projects">[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [projectData, setProjectData] = useState<Tables<"projects"> | null>(null);
  const [riskData, setRiskData] = useState<Tables<"risk_registers">[]>([]);
  const [budgetData, setBudgetData] = useState<Tables<"budget_entries">[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Fetch user projects
  useEffect(() => {
    if (!user) return;
    supabase.from("projects").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setProjects(data || []));
  }, [user]);

  // Fetch project-related data when project selected
  useEffect(() => {
    if (!selectedProjectId || !user) {
      setProjectData(null);
      setRiskData([]);
      setBudgetData([]);
      return;
    }
    setLoadingData(true);
    const project = projects.find(p => p.id === selectedProjectId);
    setProjectData(project || null);

    Promise.all([
      supabase.from("risk_registers").select("*").eq("project_id", selectedProjectId).eq("user_id", user.id),
      supabase.from("budget_entries").select("*").eq("project_id", selectedProjectId).eq("user_id", user.id),
    ]).then(([risksRes, budgetRes]) => {
      setRiskData(risksRes.data || []);
      setBudgetData(budgetRes.data || []);
      setLoadingData(false);
    });
  }, [selectedProjectId, user, projects]);

  const selected = documentTypes.find(d => d.id === selectedType);
  const needsAutoFill = selected?.autoFill || [];

  const handleGenerate = async () => {
    if (!selectedType) {
      toast.error("Pilih jenis dokumen.");
      return;
    }

    setGenerating(true);
    setResult(null);

    try {
      const body: {
        documentType: string;
        context: string;
        projectData?: Tables<"projects">;
        riskData?: Tables<"risk_registers">[];
        budgetData?: Tables<"budget_entries">[];
      } = { documentType: selectedType, context: context.trim() };
      if (projectData) body.projectData = projectData;
      if (needsAutoFill.includes("risks") && riskData.length > 0) body.riskData = riskData;
      if (needsAutoFill.includes("budget") && budgetData.length > 0) body.budgetData = budgetData;

      const { data, error } = await supabase.functions.invoke("generate-document", { body });
      if (error) throw error;
      // Clean up markdown output
      let content = data.content || "";
      // Remove standalone lines of only dashes (3+) that aren't table separators (no pipes)
      content = content.replace(/^(?!.*\|)-{3,}\s*$/gm, "");
      // Remove standalone lines of only equals
      content = content.replace(/^={3,}\s*$/gm, "");
      // Collapse multiple empty lines
      content = content.replace(/\n{4,}/g, "\n\n");
      setResult(content.trim());
      toast.success("Dokumen berhasil digenerate!");
    } catch (err: unknown) {
      toast.error("Gagal generate: " + (err instanceof Error ? err.message : "Unknown error"));
    }
    setGenerating(false);
  };

  const copyToClipboard = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    toast.success("Disalin ke clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadAsFile = () => {
    if (!result) return;
    const blob = new Blob([result], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selected?.shortName || "document"}_${projectData?.name?.replace(/\s+/g, "_") || "draft"}_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAsPdf = async () => {
    if (!pdfRef.current) return;
    toast.info("Menyiapkan PDF...");
    const filename = `${selected?.shortName || "document"}_${projectData?.name?.replace(/\s+/g, "_") || "draft"}_${new Date().toISOString().slice(0, 10)}.pdf`;
    try {
      const pdfOptions = {
        margin: [15, 15, 15, 15] as [number, number, number, number],
        filename,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      };
      await html2pdf().set(pdfOptions).from(pdfRef.current).save();
      toast.success("PDF berhasil didownload!");
    } catch (err) {
      toast.error("Gagal membuat PDF");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-foreground flex items-center gap-3">
          <FileText className="w-7 h-7 text-pub-amber" />
          Generator Dokumen
        </h1>
        <p className="text-muted-foreground font-body mt-1">
          Generate dokumen manajerial dengan <span className="text-pub-amber font-semibold">auto-fill</span> dari data proyek, risk register & budget tracker.
        </p>
      </div>

      {/* Step 1: Document type */}
      <div>
        <p className="text-xs font-heading text-muted-foreground mb-2 flex items-center gap-1">
          <span className="w-5 h-5 rounded-full bg-pub-amber/20 text-pub-amber flex items-center justify-center text-xs font-bold">1</span>
          Pilih Jenis Dokumen
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {documentTypes.map(dt => (
            <motion.button
              key={dt.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setSelectedType(dt.id); setResult(null); }}
              className={`p-4 rounded-xl border text-left transition-all ${
                selectedType === dt.id
                  ? "border-accent bg-accent/5 shadow-amber"
                  : "border-border bg-card shadow-card hover:shadow-card-hover"
              }`}
            >
              <div className={`w-10 h-10 rounded-lg ${dt.bg} flex items-center justify-center mb-2`}>
                <dt.icon className={`w-5 h-5 ${dt.color}`} />
              </div>
              <p className="font-heading font-bold text-foreground text-sm">{dt.shortName}</p>
              <p className="text-xs text-muted-foreground font-body mt-0.5 line-clamp-2">{dt.description}</p>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Step 2: Project picker + auto-fill */}
      {selectedType && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div>
            <p className="text-xs font-heading text-muted-foreground mb-2 flex items-center gap-1">
              <span className="w-5 h-5 rounded-full bg-pub-amber/20 text-pub-amber flex items-center justify-center text-xs font-bold">2</span>
              Pilih Proyek (Auto-fill Data)
            </p>
            <div className="bg-card border border-border rounded-xl p-5 shadow-card">
              <div className="flex items-center gap-3 mb-4">
                <FolderKanban className="w-5 h-5 text-pub-sky" />
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Pilih proyek untuk auto-fill data..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {p.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Auto-fill summary */}
              {selectedProjectId && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                  {loadingData ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /> Memuat data proyek...
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      <div className={`p-3 rounded-lg border ${projectData ? "border-pub-emerald/30 bg-pub-emerald/5" : "border-border bg-muted/30"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <FolderKanban className="w-4 h-4 text-pub-emerald" />
                          <span className="text-xs font-heading font-semibold text-foreground">Proyek</span>
                        </div>
                        {projectData ? (
                          <p className="text-xs text-pub-emerald font-body">✓ {projectData.name}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground font-body">Tidak ada data</p>
                        )}
                      </div>
                      <div className={`p-3 rounded-lg border ${riskData.length > 0 ? "border-pub-amber/30 bg-pub-amber/5" : "border-border bg-muted/30"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className="w-4 h-4 text-pub-amber" />
                          <span className="text-xs font-heading font-semibold text-foreground">Risk Register</span>
                        </div>
                        <p className={`text-xs font-body ${riskData.length > 0 ? "text-pub-amber" : "text-muted-foreground"}`}>
                          {riskData.length > 0 ? `✓ ${riskData.length} risiko` : "Belum ada"}
                        </p>
                      </div>
                      <div className={`p-3 rounded-lg border ${budgetData.length > 0 ? "border-pub-sky/30 bg-pub-sky/5" : "border-border bg-muted/30"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign className="w-4 h-4 text-pub-sky" />
                          <span className="text-xs font-heading font-semibold text-foreground">Budget</span>
                        </div>
                        <p className={`text-xs font-body ${budgetData.length > 0 ? "text-pub-sky" : "text-muted-foreground"}`}>
                          {budgetData.length > 0 ? `✓ ${budgetData.length} entri` : "Belum ada"}
                        </p>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {projects.length === 0 && (
                <p className="text-xs text-muted-foreground font-body">
                  Belum ada proyek. Anda tetap bisa generate dengan konteks manual.
                </p>
              )}
            </div>
          </div>

          {/* Step 3: Additional context */}
          <div>
            <p className="text-xs font-heading text-muted-foreground mb-2 flex items-center gap-1">
              <span className="w-5 h-5 rounded-full bg-pub-amber/20 text-pub-amber flex items-center justify-center text-xs font-bold">3</span>
              Konteks Tambahan (Opsional)
            </p>
            <div className="bg-card border border-border rounded-xl p-5 shadow-card">
              <textarea
                value={context}
                onChange={e => setContext(e.target.value)}
                placeholder="cth: Fokus pada risiko keterlambatan material dan cuaca buruk. Proyek berlokasi di area rawan banjir. Gunakan format tabel untuk daftar risiko."
                rows={3}
                className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground font-body text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
              <div className="mt-4">
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-amber text-accent-foreground font-heading font-semibold shadow-amber hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Menggenerate...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      Generate {selected?.shortName}
                      {projectData && <span className="text-xs opacity-80 ml-1">(Auto-filled)</span>}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Result */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
            <h3 className="font-heading font-bold text-foreground text-sm flex items-center gap-2">
              <Database className="w-4 h-4 text-pub-amber" />
              Hasil: {selected?.name}
              {projectData && <span className="text-xs text-pub-emerald font-body">(data dari: {projectData.name})</span>}
            </h3>
            <div className="flex gap-2">
              <button onClick={copyToClipboard} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-heading text-foreground hover:bg-muted transition-colors">
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-pub-emerald" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Disalin!" : "Salin"}
              </button>
              <button onClick={downloadAsFile} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-heading text-foreground hover:bg-muted transition-colors">
                <Download className="w-3.5 h-3.5" />
                .md
              </button>
              <button onClick={downloadAsPdf} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pub-amber/20 border border-pub-amber/30 text-xs font-heading text-pub-amber hover:bg-pub-amber/30 transition-colors">
                <FileDown className="w-3.5 h-3.5" />
                PDF
              </button>
            </div>
          </div>
          <div ref={pdfRef} className="p-6 font-body generator-preview">
            <MarkdownRenderer>{result}</MarkdownRenderer>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Generator;

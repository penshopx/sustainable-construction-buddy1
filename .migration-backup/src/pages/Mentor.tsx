import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useMentorChat, MentorType } from "@/hooks/useMentorChat";
import MentorChatPanel from "@/components/mentor/MentorChatPanel";
import KnowledgeBaseManager from "@/components/mentor/KnowledgeBaseManager";
import ExternalBotManager from "@/components/mentor/ExternalBotManager";
import ExpertBotCatalog from "@/components/mentor/ExpertBotCatalog";
import { BUILT_IN_BOTS } from "@/components/mentor/expert-bot-catalog-data";
import MiniAppsCatalog from "@/components/mentor/MiniAppsCatalog";
import {
  BookOpen, Brain, Wrench, HardHat, Shield, DollarSign,
  FileText, Lightbulb, Target, TrendingUp, AlertTriangle,
} from "lucide-react";

const TABS: { key: MentorType; label: string; icon: React.ElementType; color: string }[] = [
  { key: "learning", label: "Pendamping Belajar", icon: BookOpen, color: "text-blue-500" },
  { key: "expert", label: "Pakar Cerdas", icon: Brain, color: "text-pub-amber" },
  { key: "project", label: "Problem Solver", icon: Wrench, color: "text-emerald-500" },
];

import { Scale } from "lucide-react";

const QUICK_PROMPTS_LEARNING = [
  { icon: BookOpen, text: "Rangkum poin-poin utama dari modul ini" },
  { icon: Lightbulb, text: "Jelaskan konsep yang paling penting dari materi ini" },
  { icon: Target, text: "Buatkan soal latihan dari modul ini" },
  { icon: FileText, text: "Apa yang harus saya pahami sebelum lanjut ke bab berikutnya?" },
];

const QUICK_PROMPTS_PROJECT = [
  { icon: AlertTriangle, text: "Analisis risiko utama proyek ini dan rekomendasikan mitigasi" },
  { icon: TrendingUp, text: "Evaluasi kinerja anggaran proyek ini" },
  { icon: Target, text: "Apa langkah prioritas untuk mengatasi keterlambatan?" },
  { icon: Shield, text: "Review kepatuhan K3 proyek ini" },
];

const EXPERT_QUICK_PROMPTS: Record<string, { icon: React.ElementType; text: string }[]> = {
  orchestrator: [
    { icon: Brain, text: "Apa itu WBS dan bagaimana cara membuatnya?" },
    { icon: Shield, text: "Jelaskan langkah identifikasi risiko proyek konstruksi" },
    { icon: DollarSign, text: "Bagaimana cara membuat RAB yang akurat?" },
    { icon: FileText, text: "Apa saja prinsip Good Corporate Governance untuk BUJK?" },
  ],
  regulasi: [
    { icon: Scale, text: "Apa saja persyaratan SBU menurut PP 22/2020?" },
    { icon: FileText, text: "Jelaskan proses perizinan BUJK terbaru sesuai Permen PUPR" },
    { icon: Scale, text: "Apa perbedaan kualifikasi kecil, menengah, dan besar?" },
    { icon: FileText, text: "Bagaimana aturan sub-klasifikasi jasa konstruksi terbaru?" },
  ],
  manpro: [
    { icon: HardHat, text: "Bagaimana menyusun WBS untuk proyek gedung bertingkat?" },
    { icon: Target, text: "Jelaskan metode Earned Value Management (EVM)" },
    { icon: TrendingUp, text: "Cara membuat S-Curve dan menganalisis deviasi progress" },
    { icon: HardHat, text: "Apa langkah menyusun CPM (Critical Path Method)?" },
  ],
  k3: [
    { icon: Shield, text: "Apa saja elemen SMK3 yang wajib diterapkan di proyek?" },
    { icon: AlertTriangle, text: "Bagaimana prosedur investigasi kecelakaan kerja?" },
    { icon: Shield, text: "Jelaskan persyaratan ISO 45001 untuk proyek konstruksi" },
    { icon: AlertTriangle, text: "Cara membuat JSA (Job Safety Analysis) yang efektif" },
  ],
  keuangan: [
    { icon: DollarSign, text: "Bagaimana cara menyusun laporan LKUT yang benar?" },
    { icon: DollarSign, text: "Jelaskan komponen neraca keuangan BUJK" },
    { icon: TrendingUp, text: "Cara menghitung rasio keuangan untuk kualifikasi SBU" },
    { icon: DollarSign, text: "Apa kewajiban perpajakan khusus untuk jasa konstruksi?" },
  ],
};

const getQuickPrompts = (tab: MentorType, expertBotId: string) => {
  if (tab === "learning") return QUICK_PROMPTS_LEARNING;
  if (tab === "project") return QUICK_PROMPTS_PROJECT;
  return EXPERT_QUICK_PROMPTS[expertBotId] || EXPERT_QUICK_PROMPTS.orchestrator;
};

const EMPTY_TITLES: Record<MentorType, string> = {
  learning: "Mentor Pembelajaran 📚",
  expert: "Pakar Cerdas Konstruksi 🧠",
  project: "Problem Solver Proyek 🔧",
};

const EMPTY_DESCS: Record<MentorType, string> = {
  learning: "Upload modul pembelajaran, lalu tanyakan apapun tentang materi tersebut. Saya akan mendampingi Anda belajar.",
  expert: "Saya adalah perpustakaan hidup manajemen konstruksi. Tanyakan regulasi, standar, atau best practice apapun.",
  project: "Pilih proyek, lalu saya akan menganalisis data dan membantu menyelesaikan masalah spesifik proyek Anda.",
};

interface Project {
  id: string;
  name: string;
  status: string;
}

const Mentor = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<MentorType>("learning");
  const mentor = useMentorChat(activeTab);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("projects")
      .select("id, name, status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setProjects((data as Project[]) || []));
  }, [user]);

  return (
    <div className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      {/* Tab Header */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-heading font-semibold whitespace-nowrap transition-all ${
              activeTab === tab.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sidebar - mobile: horizontal collapsible, desktop: vertical */}
      <div className="lg:hidden mb-3 p-3 rounded-xl border border-border bg-card">
        {activeTab === "learning" && (
          <KnowledgeBaseManager
            label="Modul Pembelajaran"
            knowledgeBases={mentor.knowledgeBases}
            selectedKbId={mentor.selectedKbId}
            onSelect={mentor.setSelectedKbId}
            onUpload={mentor.uploadKnowledgeBase}
            onDelete={mentor.deleteKnowledgeBase}
          />
        )}
        {activeTab === "expert" && (
          <>
            <ExpertBotCatalog compact selectedBotId={mentor.selectedExpertBotId} onSelect={mentor.setSelectedExpertBotId} />
            <div className="mt-2">
              <ExternalBotManager bots={mentor.externalBots} onAdd={mentor.addExternalBot} onDelete={mentor.deleteExternalBot} />
            </div>
          </>
        )}
        {activeTab === "project" && (
          <>
            <div className="space-y-2 mb-3">
              <h4 className="text-sm font-heading font-semibold text-foreground">Pilih Proyek</h4>
              <div className="flex flex-wrap gap-1.5">
                {projects.length === 0 && <p className="text-xs text-muted-foreground">Belum ada proyek.</p>}
                {projects.map(p => (
                  <button key={p.id} onClick={() => mentor.setSelectedProjectId(p.id === mentor.selectedProjectId ? null : p.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                      p.id === mentor.selectedProjectId ? "bg-primary/10 border border-primary/20 text-foreground" : "hover:bg-muted border border-border text-muted-foreground"
                    }`}>
                    <Wrench className="w-3 h-3" /> {p.name}
                  </button>
                ))}
              </div>
            </div>
            <MiniAppsCatalog compact />
            <div className="mt-2">
              <KnowledgeBaseManager
                label="Brain Project (Dokumen)"
                knowledgeBases={mentor.knowledgeBases}
                selectedKbId={mentor.selectedKbId}
                onSelect={mentor.setSelectedKbId}
                onUpload={mentor.uploadKnowledgeBase}
                onDelete={mentor.deleteKnowledgeBase}
                projectId={mentor.selectedProjectId || undefined}
              />
            </div>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Sidebar - desktop only */}
        <div className="w-72 shrink-0 hidden lg:flex flex-col gap-4 overflow-y-auto">
          {activeTab === "learning" && (
            <KnowledgeBaseManager
              label="Modul Pembelajaran"
              knowledgeBases={mentor.knowledgeBases}
              selectedKbId={mentor.selectedKbId}
              onSelect={mentor.setSelectedKbId}
              onUpload={mentor.uploadKnowledgeBase}
              onDelete={mentor.deleteKnowledgeBase}
            />
          )}

          {activeTab === "expert" && (
            <>
              <ExpertBotCatalog selectedBotId={mentor.selectedExpertBotId} onSelect={mentor.setSelectedExpertBotId} />
              <ExternalBotManager
                bots={mentor.externalBots}
                onAdd={mentor.addExternalBot}
                onDelete={mentor.deleteExternalBot}
              />
            </>
          )}

          {activeTab === "project" && (
            <>
              {/* Project Selector */}
              <div className="space-y-2">
                <h4 className="text-sm font-heading font-semibold text-foreground">Pilih Proyek</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {projects.length === 0 && <p className="text-xs text-muted-foreground py-2">Belum ada proyek.</p>}
                  {projects.map(p => (
                    <button key={p.id} onClick={() => mentor.setSelectedProjectId(p.id === mentor.selectedProjectId ? null : p.id)}
                      className={`w-full text-left flex items-center gap-2 p-2.5 rounded-xl transition-colors text-sm ${
                        p.id === mentor.selectedProjectId
                          ? "bg-primary/10 border border-primary/20 text-foreground"
                          : "hover:bg-muted border border-transparent text-muted-foreground"
                      }`}>
                      <Wrench className="w-4 h-4 shrink-0" />
                      <span className="truncate">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <MiniAppsCatalog />
              <KnowledgeBaseManager
                label="Brain Project (Dokumen)"
                knowledgeBases={mentor.knowledgeBases}
                selectedKbId={mentor.selectedKbId}
                onSelect={mentor.setSelectedKbId}
                onUpload={mentor.uploadKnowledgeBase}
                onDelete={mentor.deleteKnowledgeBase}
                projectId={mentor.selectedProjectId || undefined}
              />
            </>
          )}
        </div>

        {/* Chat Panel */}
        <div className="flex-1 min-w-0">
          <MentorChatPanel
            messages={mentor.messages}
            isLoading={mentor.isLoading}
            conversations={mentor.conversations}
            activeConversationId={mentor.activeConversationId}
            onSend={mentor.sendMessage}
            onSelectConversation={mentor.selectConversation}
            onNewConversation={mentor.startNewConversation}
            onDeleteConversation={mentor.deleteConversation}
            quickPrompts={getQuickPrompts(activeTab, mentor.selectedExpertBotId)}
            emptyTitle={activeTab === "expert"
              ? (BUILT_IN_BOTS.find(b => b.id === mentor.selectedExpertBotId)?.name || EMPTY_TITLES[activeTab])
              : EMPTY_TITLES[activeTab]}
            emptyDescription={activeTab === "expert"
              ? (BUILT_IN_BOTS.find(b => b.id === mentor.selectedExpertBotId)?.description || EMPTY_DESCS[activeTab])
              : EMPTY_DESCS[activeTab]}
          />
        </div>
      </div>
    </div>
  );
};

export default Mentor;

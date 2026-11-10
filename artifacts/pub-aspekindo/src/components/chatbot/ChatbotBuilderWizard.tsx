import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Upload, Sparkles, Bot, GraduationCap, Briefcase, FolderKanban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { ChatbotFormData } from "@/hooks/useCustomChatbots";
import { ChatbotKnowledgeStep } from "./ChatbotKnowledgeStep";
import { ChatbotToolsStep } from "./ChatbotToolsStep";

const STEPS = ["Nama & Mode", "Avatar", "Persona", "Knowledge Base", "Tools"];

const MODE_OPTIONS = [
  { value: "pembelajaran", label: "Mentor Pembelajaran", icon: GraduationCap, desc: "Share ke tim belajar" },
  { value: "proyek", label: "Chatbot Proyek", icon: FolderKanban, desc: "Share ke tim proyek" },
  { value: "profesi", label: "Chatbot Profesi", icon: Briefcase, desc: "Admin only — Marketplace publik" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ChatbotFormData) => Promise<unknown>;
}

export function ChatbotBuilderWizard({ open, onOpenChange, onSubmit }: Props) {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<ChatbotFormData>({
    name: "",
    description: "",
    avatar_url: "",
    mode: "pembelajaran",
    persona: "",
    welcome_message: "",
    tools: [],
    is_public: false,
    project_id: null,
    knowledge_base_ids: [],
  });

  const availableModes = isAdmin
    ? MODE_OPTIONS
    : MODE_OPTIONS.filter((m) => m.value !== "profesi");

  const updateField = <K extends keyof ChatbotFormData>(key: K, value: ChatbotFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const path = `${user.id}/${crypto.randomUUID()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("chatbot-avatars").upload(path, file);
    if (error) return;
    const { data: urlData } = supabase.storage.from("chatbot-avatars").getPublicUrl(path);
    updateField("avatar_url", urlData.publicUrl);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    if (form.mode === "profesi") {
      updateField("is_public", true);
    }
    const result = await onSubmit({ ...form, is_public: form.mode === "profesi" });
    setSubmitting(false);
    if (result) {
      onOpenChange(false);
      setStep(0);
      setForm({
        name: "", description: "", avatar_url: "", mode: "pembelajaran",
        persona: "", welcome_message: "", tools: [], is_public: false,
        project_id: null, knowledge_base_ids: [],
      });
    }
  };

  const canNext = () => {
    if (step === 0) return form.name.trim().length > 0;
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            Buat Chatbot Baru
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-4">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-1 flex-1">
              <div className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`} />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Langkah {step + 1}/{STEPS.length}: {STEPS[step]}
        </p>

        {/* Step 0: Name & Mode */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <Label>Nama Chatbot *</Label>
              <Input
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Contoh: Mentor PANCEK Ahli"
              />
            </div>
            <div>
              <Label>Deskripsi singkat</Label>
              <Textarea
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Deskripsi chatbot..."
                rows={2}
              />
            </div>
            <div>
              <Label>Mode Chatbot</Label>
              <div className="grid gap-2 mt-1">
                {availableModes.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => updateField("mode", m.value)}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                      form.mode === m.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent/50"
                    }`}
                  >
                    <m.icon className="w-5 h-5 text-primary shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{m.label}</p>
                      <p className="text-xs text-muted-foreground">{m.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Avatar */}
        {step === 1 && (
          <div className="space-y-4">
            <Label>Upload Avatar (opsional)</Label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
                {form.avatar_url ? (
                  <img src={form.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <Bot className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <div>
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                  <Button variant="outline" size="sm" asChild>
                    <span><Upload className="w-4 h-4 mr-1" /> Pilih Gambar</span>
                  </Button>
                </label>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG, max 2MB</p>
              </div>
            </div>
            <div>
              <Label>Pesan Sambutan</Label>
              <Textarea
                value={form.welcome_message}
                onChange={(e) => updateField("welcome_message", e.target.value)}
                placeholder="Halo! Saya siap membantu Anda..."
                rows={2}
              />
            </div>
          </div>
        )}

        {/* Step 2: Persona */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label>Persona / System Prompt</Label>
              <p className="text-xs text-muted-foreground mb-1">
                Definisikan kepribadian, keahlian, dan cara chatbot berkomunikasi.
              </p>
              <Textarea
                value={form.persona}
                onChange={(e) => updateField("persona", e.target.value)}
                placeholder="Kamu adalah ahli manajemen proyek konstruksi dengan pengalaman 20 tahun. Kamu selalu memberikan jawaban berbasis data dan referensi regulasi terkini..."
                rows={8}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const templates: Record<string, string> = {
                  pembelajaran: "Kamu adalah mentor PUB yang sabar dan sistematis. Jelaskan konsep dengan analogi praktis dari industri konstruksi. Berikan kuis singkat untuk mengecek pemahaman. Referensikan regulasi UU 2/2017, PP 28/2025, dan Permen PU terkait.",
                  profesi: "Kamu adalah konsultan ahli SKK & SBU. Tanyakan dulu jenis BUJK, kualifikasi, dan tujuan sertifikasi. Berikan checklist persyaratan spesifik berdasarkan regulasi terbaru.",
                  proyek: "Kamu adalah konsultan manajemen proyek senior. Analisis masalah menggunakan framework terstruktur (5 Why, Fishbone). Berikan solusi multi-skenario dengan perhitungan numerik jika relevan.",
                };
                updateField("persona", templates[form.mode] || templates.pembelajaran);
              }}
            >
              <Sparkles className="w-4 h-4 mr-1" /> Gunakan Template
            </Button>
          </div>
        )}

        {/* Step 3: Knowledge Base */}
        {step === 3 && (
          <ChatbotKnowledgeStep
            selectedIds={form.knowledge_base_ids}
            onSelectionChange={(ids) => updateField("knowledge_base_ids", ids)}
          />
        )}

        {/* Step 4: Tools */}
        {step === 4 && (
          <ChatbotToolsStep
            selectedTools={form.tools}
            onSelectionChange={(tools) => updateField("tools", tools)}
            mode={form.mode}
          />
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-4 pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Kembali
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
              Lanjut <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting || !form.name.trim()}>
              {submitting ? "Menyimpan..." : "Buat Chatbot"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useRiskRegisters } from "@/hooks/useRiskRegisters";
import { useProjects } from "@/hooks/useProjects";
import { RiskForm } from "@/components/risk/RiskForm";
import { RiskList } from "@/components/risk/RiskList";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ShieldAlert } from "lucide-react";

type View = { type: 'list' } | { type: 'create' };

const RiskRegisterPage = () => {
  const [searchParams] = useSearchParams();
  const initialProjectId = searchParams.get('project') || undefined;
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(initialProjectId);
  const [view, setView] = useState<View>({ type: 'list' });

  const { projects } = useProjects();
  const { risks, isLoading, createRisk, deleteRisk } = useRiskRegisters(selectedProjectId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading">Risk Register</h1>
            <p className="text-sm text-muted-foreground font-body">Identifikasi, analisis, dan mitigasi risiko proyek</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Project filter */}
          <Select value={selectedProjectId || 'all'} onValueChange={v => setSelectedProjectId(v === 'all' ? undefined : v)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Semua Proyek" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Proyek</SelectItem>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {view.type === 'list' && (
            <Button onClick={() => setView({ type: 'create' })} className="bg-gradient-amber text-accent-foreground font-heading shadow-amber hover:brightness-110">
              <Plus className="w-4 h-4 mr-1" /> Tambah Risiko
            </Button>
          )}
          {view.type !== 'list' && (
            <Button variant="outline" onClick={() => setView({ type: 'list' })}>← Kembali</Button>
          )}
        </div>
      </div>

      {/* Content */}
      {view.type === 'list' && (
        <RiskList risks={risks} isLoading={isLoading} onDelete={(id) => deleteRisk.mutate(id)} />
      )}

      {view.type === 'create' && (
        <RiskForm
          projectId={selectedProjectId || null}
          projects={projects}
          onSubmit={(data) => {
            createRisk.mutate(data, { onSuccess: () => setView({ type: 'list' }) });
          }}
          isSubmitting={createRisk.isPending}
        />
      )}
    </div>
  );
};

export default RiskRegisterPage;

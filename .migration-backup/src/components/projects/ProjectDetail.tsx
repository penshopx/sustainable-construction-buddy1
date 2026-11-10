import { useProject, type Project } from "@/hooks/useProjects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getComplexityLabel, getComplexityPoints } from "@/lib/complexity";
import { MapPin, Calendar, TrendingUp, FileText, ShieldAlert, DollarSign, Hammer } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ProjectDetailProps {
  projectId: string;
  onBack: () => void;
  onUpdate: (data: Partial<Project> & { id: string }) => void;
}

const CONTRACT_LABELS: Record<string, string> = {
  lumpsum: 'Lump Sum',
  unit_price: 'Harga Satuan',
  turnkey: 'Turnkey',
  design_build: 'Design & Build',
  epc: 'EPC',
  cost_plus: 'Cost Plus',
};

const RISK_LABELS: Record<string, string> = {
  low: 'Rendah',
  medium: 'Sedang',
  high: 'Tinggi',
};

export function ProjectDetail({ projectId }: ProjectDetailProps) {
  const { data: project, isLoading } = useProject(projectId);
  const navigate = useNavigate();

  if (isLoading || !project) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}</div>;
  }

  const complexity = getComplexityLabel(project.complexity_score);
  const points = getComplexityPoints(project.complexity_score);

  return (
    <div className="space-y-6">
      {/* Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl font-heading">{project.name}</CardTitle>
              <p className="text-sm text-muted-foreground font-body mt-1">{project.bujk_name || '—'}</p>
            </div>
            <div className="flex gap-2">
              <Badge variant={project.status === 'active' ? 'default' : 'secondary'} className="capitalize">{project.status}</Badge>
              <Badge variant={complexity.color as 'default' | 'secondary' | 'destructive'}>{complexity.label}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {project.description && <p className="text-sm text-muted-foreground mb-4">{project.description}</p>}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InfoCard icon={DollarSign} label="Nilai Proyek" value={`Rp ${(project.value_amount / 1_000_000_000).toFixed(1)}M`} />
            <InfoCard icon={Calendar} label="Durasi" value={`${project.duration_months} bulan`} />
            <InfoCard icon={MapPin} label="Lokasi" value={project.location || '—'} />
            <InfoCard icon={Hammer} label="Kontrak" value={CONTRACT_LABELS[project.contract_type] || project.contract_type} />
          </div>
        </CardContent>
      </Card>

      {/* Complexity & Scoring */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="border-pub-amber/30">
          <CardContent className="p-5 text-center space-y-2">
            <TrendingUp className="w-8 h-8 text-pub-amber mx-auto" />
            <p className="text-sm text-muted-foreground font-body">Skor Kompleksitas</p>
            <p className="text-4xl font-extrabold font-heading text-primary">{project.complexity_score}</p>
            <Badge variant={complexity.color as 'default' | 'secondary' | 'destructive'}>{complexity.label}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center space-y-2">
            <TrendingUp className="w-8 h-8 text-pub-emerald mx-auto" />
            <p className="text-sm text-muted-foreground font-body">Poin Kompetensi</p>
            <p className="text-4xl font-extrabold font-heading text-pub-emerald">+{points}</p>
            <p className="text-xs text-muted-foreground">Dari proyek ini</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center space-y-2">
            <ShieldAlert className="w-8 h-8 text-pub-sky mx-auto" />
            <p className="text-sm text-muted-foreground font-body">Kelas Risiko</p>
            <p className="text-2xl font-bold font-heading">{RISK_LABELS[project.risk_class]}</p>
            <p className="text-xs text-muted-foreground">{project.multidiscipline ? 'Multi-disiplin' : 'Single-disiplin'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Toolkit links (placeholder) */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" /> Toolkit Terhubung
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-3">
            {[
              { name: 'Risk Register', desc: 'Identifikasi & mitigasi risiko proyek', available: true, onClick: () => navigate(`/risk-register?project=${project.id}`) },
              { name: 'Budget Tracker', desc: 'Monitor cashflow & deviasi anggaran', available: true, onClick: () => navigate(`/budget-tracker?project=${project.id}`) },
              { name: 'K3 Checklist', desc: 'Inspeksi keselamatan kerja', available: true, onClick: () => navigate(`/k3-checklist?project=${project.id}`) },
            ].map((tool, i) => (
              <div key={i} onClick={tool.available ? tool.onClick : undefined} className={`p-4 rounded-lg border ${tool.available ? 'border-pub-amber/30 bg-pub-amber/5 cursor-pointer hover:bg-pub-amber/10' : 'border-border bg-muted/30 opacity-60'} transition-colors`}>
                <p className="font-semibold font-heading text-sm">{tool.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{tool.desc}</p>
                {!tool.available && <Badge variant="outline" className="mt-2 text-xs">Segera Hadir</Badge>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground font-body">{label}</p>
        <p className="text-sm font-semibold font-heading">{value}</p>
      </div>
    </div>
  );
}

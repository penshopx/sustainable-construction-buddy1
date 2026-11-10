import { type Project } from "@/hooks/useProjects";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getComplexityLabel, getComplexityPoints } from "@/lib/complexity";
import { MapPin, Calendar, Trash2, TrendingUp, FolderOpen } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface ProjectListProps {
  projects: Project[];
  isLoading: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

const CONTRACT_LABELS: Record<string, string> = {
  lumpsum: 'Lump Sum',
  unit_price: 'Harga Satuan',
  turnkey: 'Turnkey',
  design_build: 'Design & Build',
  epc: 'EPC',
  cost_plus: 'Cost Plus',
};

export function ProjectList({ projects, isLoading, onSelect, onDelete }: ProjectListProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map(i => (
          <Card key={i}><CardContent className="p-6"><Skeleton className="h-32" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <FolderOpen className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold font-heading mb-1">Belum ada proyek</h3>
          <p className="text-sm text-muted-foreground font-body mb-6">Buat proyek pertama Anda untuk mulai membangun evidence kompetensi</p>
          <div className="grid sm:grid-cols-3 gap-3 w-full max-w-2xl text-left">
            {[
              { name: "Pembangunan Gedung Kantor 5 Lt", type: "Design & Build", value: "Rp 25M", complexity: "Tinggi" },
              { name: "Renovasi Jalan Provinsi Km 12-18", type: "Harga Satuan", value: "Rp 8.5M", complexity: "Sedang" },
              { name: "Drainase & Saluran Air Kec. Menteng", type: "Lump Sum", value: "Rp 2.1M", complexity: "Rendah" },
            ].map((ex, i) => (
              <div key={i} className="p-3 rounded-lg border border-dashed border-border bg-muted/30">
                <p className="text-xs font-heading font-semibold text-foreground">{ex.name}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{ex.type} · {ex.value}</p>
                <Badge variant="outline" className="text-[10px] mt-1.5">{ex.complexity}</Badge>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">👆 Contoh proyek yang bisa Anda catat untuk membangun portofolio kompetensi</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => {
        const complexity = getComplexityLabel(project.complexity_score);
        const points = getComplexityPoints(project.complexity_score);
        return (
          <Card
            key={project.id}
            className="cursor-pointer hover:shadow-card-hover transition-shadow duration-200 group"
            onClick={() => onSelect(project.id)}
          >
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold font-heading text-base truncate group-hover:text-primary transition-colors">{project.name}</h3>
                  <p className="text-xs text-muted-foreground font-body truncate">{project.bujk_name || '—'}</p>
                </div>
                <Badge variant={complexity.color as 'default' | 'secondary' | 'destructive'} className="ml-2 shrink-0 text-xs">
                  {complexity.label}
                </Badge>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {project.location && (
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{project.location}</span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {project.duration_months} bln
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-xs">{CONTRACT_LABELS[project.contract_type] || project.contract_type}</Badge>
                  <Badge variant={project.status === 'active' ? 'default' : 'secondary'} className="text-xs capitalize">{project.status}</Badge>
                </div>
                <div className="flex items-center gap-1 text-xs font-medium text-pub-amber">
                  <TrendingUp className="w-3 h-3" /> +{points} poin
                </div>
              </div>

              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>Rp {(project.value_amount / 1_000_000_000).toFixed(1)}M</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

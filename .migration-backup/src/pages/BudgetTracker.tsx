import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useBudgetEntries } from "@/hooks/useBudgetEntries";
import { useProjects } from "@/hooks/useProjects";
import { BudgetForm } from "@/components/budget/BudgetForm";
import { BudgetList } from "@/components/budget/BudgetList";
import { BudgetSummary } from "@/components/budget/BudgetSummary";
import { BudgetChart } from "@/components/budget/BudgetChart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DollarSign, Plus } from "lucide-react";

const BudgetTracker = () => {
  const [searchParams] = useSearchParams();
  const projectParam = searchParams.get('project') || undefined;
  const [selectedProject, setSelectedProject] = useState<string | undefined>(projectParam);
  const [showForm, setShowForm] = useState(false);

  const { projects } = useProjects();
  const { entries, isLoading, createEntry, deleteEntry, summary } = useBudgetEntries(selectedProject);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading">Budget Tracker</h1>
            <p className="text-sm text-muted-foreground font-body">Monitor cashflow & deviasi anggaran proyek</p>
          </div>
        </div>
        <Button onClick={() => setShowForm(v => !v)} className="bg-gradient-amber text-accent-foreground font-heading shadow-amber hover:brightness-110">
          <Plus className="w-4 h-4 mr-1" /> {showForm ? 'Tutup Form' : 'Tambah Entri'}
        </Button>
      </div>

      {/* Project Filter */}
      <div className="max-w-xs">
        <Select value={selectedProject || 'all'} onValueChange={v => setSelectedProject(v === 'all' ? undefined : v)}>
          <SelectTrigger><SelectValue placeholder="Filter proyek" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Proyek</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <BudgetSummary {...summary} />

      {/* Form */}
      {showForm && (
        <BudgetForm
          projectId={selectedProject}
          onSubmit={(data) => {
            createEntry.mutate(data, { onSuccess: () => setShowForm(false) });
          }}
          isSubmitting={createEntry.isPending}
        />
      )}

      {/* Chart */}
      <BudgetChart entries={entries} />

      {/* List */}
      <BudgetList entries={entries} isLoading={isLoading} onDelete={(id) => deleteEntry.mutate(id)} />
    </div>
  );
};

export default BudgetTracker;

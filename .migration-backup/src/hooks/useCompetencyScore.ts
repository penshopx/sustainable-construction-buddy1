import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Scoring weights as per PRD
const WEIGHTS = {
  learning: 0.25,
  toolkit: 0.35,
  project: 0.25,
  contribution: 0.15,
};

// Normalization caps (max raw points before normalization)
const CAPS = {
  learning: 40,
  toolkit: 60,
  project: 40,
  contribution: 30,
};

// Level thresholds
export const LEVEL_THRESHOLDS = {
  Pemula: { min: 0, max: 59 },
  Muda: { min: 60, max: 74 },
  Madya: { min: 75, max: 84 },
  Utama: { min: 85, max: 100 },
};

export interface PillarBreakdown {
  learning_points: number;
  project_points: number;
  toolkit_points: number;
  contribution_points: number;
  total_score: number;
  period: string;
  // Normalized values (0-100)
  learning_normalized?: number;
  toolkit_normalized?: number;
  project_normalized?: number;
  contribution_normalized?: number;
  // Weighted contributions
  learning_weighted?: number;
  toolkit_weighted?: number;
  project_weighted?: number;
  contribution_weighted?: number;
}

export interface LevelRequirement {
  label: string;
  met: boolean;
  current: number;
  target: number;
  type: 'project' | 'toolkit' | 'learning' | 'contribution' | 'score';
}

function getCurrentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function normalize(raw: number, cap: number): number {
  return Math.min(raw, cap) / cap * 100;
}

export function determineLevel(score: number): string {
  if (score >= 85) return "Utama";
  if (score >= 75) return "Madya";
  if (score >= 60) return "Muda";
  return "Pemula";
}

export function getNextLevel(currentLevel: string): string | null {
  const order = ["Pemula", "Muda", "Madya", "Utama"];
  const idx = order.indexOf(currentLevel);
  return idx < order.length - 1 ? order[idx + 1] : null;
}

export function useCompetencyScore() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const period = getCurrentPeriod();

  const scores = useQuery({
    queryKey: ["competency-scores", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competency_scores")
        .select("*")
        .eq("user_id", user!.id)
        .order("period", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const currentScore = scores.data?.find((s) => s.period === period);

  // Compute explainable breakdown
  const explainableScore = currentScore ? {
    learning_normalized: normalize(currentScore.learning_points, CAPS.learning),
    toolkit_normalized: normalize(currentScore.toolkit_points, CAPS.toolkit),
    project_normalized: normalize(currentScore.project_points, CAPS.project),
    contribution_normalized: normalize(currentScore.contribution_points, CAPS.contribution),
    learning_weighted: normalize(currentScore.learning_points, CAPS.learning) * WEIGHTS.learning,
    toolkit_weighted: normalize(currentScore.toolkit_points, CAPS.toolkit) * WEIGHTS.toolkit,
    project_weighted: normalize(currentScore.project_points, CAPS.project) * WEIGHTS.project,
    contribution_weighted: normalize(currentScore.contribution_points, CAPS.contribution) * WEIGHTS.contribution,
  } : null;

  const computeAndSave = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      // 1. Learning points: completed modules × 5
      const { data: moduleProgress } = await supabase
        .from("module_progress")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "completed");
      const learning_points = (moduleProgress?.length || 0) * 5;

      // 2. Project points: sum of complexity scores / 10
      const { data: projects } = await supabase
        .from("projects")
        .select("complexity_score")
        .eq("user_id", user.id);
      const project_points = (projects || []).reduce(
        (sum, p) => sum + Math.round(p.complexity_score / 10),
        0
      );

      // 3. Toolkit points: sum from toolkit_activities
      const { data: activities } = await supabase
        .from("toolkit_activities")
        .select("points_awarded")
        .eq("user_id", user.id);
      const toolkit_points = (activities || []).reduce(
        (sum, a) => sum + a.points_awarded,
        0
      );

      // 4. Contribution points
      const { data: contributions } = await supabase
        .from("contributions")
        .select("points_awarded")
        .eq("user_id", user.id);
      const contribution_points = (contributions || []).reduce(
        (sum, c) => sum + c.points_awarded,
        0
      );

      // Normalize each pillar (0-100)
      const L = normalize(learning_points, CAPS.learning);
      const T = normalize(toolkit_points, CAPS.toolkit);
      const P = normalize(project_points, CAPS.project);
      const C = normalize(contribution_points, CAPS.contribution);

      // Weighted total score (0-100)
      let total_score = Math.round(
        L * WEIGHTS.learning +
        T * WEIGHTS.toolkit +
        P * WEIGHTS.project +
        C * WEIGHTS.contribution
      );

      // Activity decay: check last activity timestamp
      const { data: lastActivity } = await supabase
        .from("toolkit_activities")
        .select("created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (lastActivity && lastActivity.length > 0) {
        const daysSince = Math.floor(
          (Date.now() - new Date(lastActivity[0].created_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSince > 365) {
          total_score = Math.round(total_score * 0.9); // 10% decay
        }
      }

      total_score = Math.min(total_score, 100);

      // Determine level
      const newLevel = determineLevel(total_score);

      // Upsert into competency_scores
      const existing = scores.data?.find((s) => s.period === period);
      if (existing) {
        const { error } = await supabase
          .from("competency_scores")
          .update({
            learning_points,
            project_points,
            toolkit_points,
            contribution_points,
            total_score,
            computed_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("competency_scores").insert({
          user_id: user.id,
          period,
          learning_points,
          project_points,
          toolkit_points,
          contribution_points,
          total_score,
        });
        if (error) throw error;
      }

      // Update profile
      await supabase
        .from("profiles")
        .update({ total_score, current_level: newLevel })
        .eq("user_id", user.id);

      return {
        learning_points,
        project_points,
        toolkit_points,
        contribution_points,
        total_score,
        period,
      } as PillarBreakdown;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competency-scores"] });
      qc.invalidateQueries({ queryKey: ["auth-profile"] });
    },
  });

  return {
    scores: scores.data || [],
    currentScore,
    explainableScore,
    isLoading: scores.isLoading,
    computeAndSave,
    WEIGHTS,
    CAPS,
  };
}

// Hook for getting level requirements
export function useLevelRequirements() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["level-requirements", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Fetch all relevant data
      const [projectsRes, toolkitRes, modulesRes, contributionsRes, profileRes] = await Promise.all([
        supabase.from("projects").select("complexity_score, status").eq("user_id", user!.id),
        supabase.from("toolkit_activities").select("tool_type, completeness").eq("user_id", user!.id),
        supabase.from("module_progress").select("status").eq("user_id", user!.id),
        supabase.from("contributions").select("type").eq("user_id", user!.id),
        supabase.from("profiles").select("current_level, total_score").eq("user_id", user!.id).single(),
      ]);

      const projects = projectsRes.data || [];
      const toolkit = toolkitRes.data || [];
      const modules = modulesRes.data || [];
      const contributions = contributionsRes.data || [];
      const profile = profileRes.data;
      const currentLevel = profile?.current_level || "Pemula";
      const totalScore = profile?.total_score || 0;

      const activeProjects = projects.filter(p => p.status === 'active').length;
      const complexProjects = projects.filter(p => p.complexity_score >= 50).length;
      const completedModules = modules.filter(m => m.status === 'completed').length;
      const toolkitActivities = toolkit.length;
      const riskActivities = toolkit.filter(t => t.tool_type === 'risk_register').length;
      const budgetActivities = toolkit.filter(t => t.tool_type === 'budget_tracker').length;
      const hasMentoring = contributions.some(c => c.type === 'mentor_session');

      const requirements: Record<string, LevelRequirement[]> = {
        Muda: [
          { label: "Skor total ≥ 60", met: totalScore >= 60, current: totalScore, target: 60, type: 'score' },
          { label: "Minimal 1 course selesai", met: completedModules >= 1, current: completedModules, target: 1, type: 'learning' },
          { label: "Minimal 1 proyek aktif", met: activeProjects >= 1, current: activeProjects, target: 1, type: 'project' },
          { label: "Minimal 1 risk register (≥80%)", met: riskActivities >= 1, current: riskActivities, target: 1, type: 'toolkit' },
          { label: "Minimal 1 budget tracker", met: budgetActivities >= 1, current: budgetActivities, target: 1, type: 'toolkit' },
        ],
        Madya: [
          { label: "Skor total ≥ 75", met: totalScore >= 75, current: totalScore, target: 75, type: 'score' },
          { label: "Minimal 3 course selesai", met: completedModules >= 3, current: completedModules, target: 3, type: 'learning' },
          { label: "Minimal 2 proyek (≥1 kompleks)", met: projects.length >= 2 && complexProjects >= 1, current: complexProjects, target: 1, type: 'project' },
          { label: "Minimal 4 aktivitas toolkit", met: toolkitActivities >= 4, current: toolkitActivities, target: 4, type: 'toolkit' },
          { label: "Minimal 1 kontribusi (SOP/sharing)", met: contributions.length >= 1, current: contributions.length, target: 1, type: 'contribution' },
        ],
        Utama: [
          { label: "Skor total ≥ 85", met: totalScore >= 85, current: totalScore, target: 85, type: 'score' },
          { label: "Minimal 5 course selesai", met: completedModules >= 5, current: completedModules, target: 5, type: 'learning' },
          { label: "Minimal 1 proyek high complexity", met: complexProjects >= 1, current: complexProjects, target: 1, type: 'project' },
          { label: "Minimal 1 mentoring session", met: hasMentoring, current: hasMentoring ? 1 : 0, target: 1, type: 'contribution' },
          { label: "Minimal 6 aktivitas toolkit", met: toolkitActivities >= 6, current: toolkitActivities, target: 6, type: 'toolkit' },
        ],
      };

      const nextLevel = getNextLevel(currentLevel);

      return {
        currentLevel,
        nextLevel,
        totalScore,
        requirements: nextLevel ? requirements[nextLevel] || [] : [],
        allRequirements: requirements,
      };
    },
  });
}

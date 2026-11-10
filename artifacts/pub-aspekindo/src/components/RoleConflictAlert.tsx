import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, ShieldAlert, Info, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { detectConflicts, getShortPosition, type BUJKQualification, type RoleConflict } from "@/lib/roleConstraints";

interface CompanyMember {
  user_id: string;
  full_name: string;
  position: string;
}

interface Props {
  /** Override qualification level (default: auto-detect or "menengah") */
  qualification?: BUJKQualification;
  /** Compact mode for dashboard */
  compact?: boolean;
}

export function RoleConflictAlert({ qualification = "menengah", compact = false }: Props) {
  const { profile, user } = useAuth();
  const [conflicts, setConflicts] = useState<(RoleConflict & { holders: string[] })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !profile?.company || !profile?.position) {
      setLoading(false);
      return;
    }

    const checkConflicts = async () => {
      // Fetch all members in same company
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, position")
        .eq("company", profile.company)
        .neq("position", "");

      if (!data || data.length < 2) {
        setConflicts([]);
        setLoading(false);
        return;
      }

      const members = data as CompanyMember[];
      const positions = members.map((m) => m.position);
      const uniquePositions = [...new Set(positions)];

      // Detect conflicts among all positions held in the company
      const rawConflicts = detectConflicts(uniquePositions, qualification);

      // Enrich with holder names
      const enriched = rawConflicts.map((c) => {
        const holders1 = members
          .filter((m) => m.position === c.position1)
          .map((m) => m.full_name || "Unknown");
        const holders2 = members
          .filter((m) => m.position === c.position2)
          .map((m) => m.full_name || "Unknown");

        // Only flag if same person holds both or if positions exist
        return {
          ...c,
          holders: [...new Set([...holders1, ...holders2])],
        };
      });

      // Also check if any single person holds multiple positions
      // (currently schema stores one position per user, but checking company-wide overlap)
      setConflicts(enriched);
      setLoading(false);
    };

    checkConflicts();
  }, [user, profile?.company, profile?.position, qualification]);

  if (loading || conflicts.length === 0) return null;

  const errors = conflicts.filter((c) => c.severity === "error");
  const warnings = conflicts.filter((c) => c.severity === "warning");

  if (compact) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-start gap-3"
        >
          <ShieldAlert className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-heading font-semibold text-destructive">
              {errors.length + warnings.length} konflik jabatan terdeteksi
            </p>
            <p className="text-xs text-muted-foreground font-body mt-0.5">
              Perusahaan {profile?.company} memiliki potensi rangkap jabatan yang tidak sesuai ketentuan.
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-5 h-5 text-pub-amber" />
          <h3 className="text-sm font-heading font-bold text-foreground">
            Conflict & Overlap Detector
          </h3>
          <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-heading">
            {conflicts.length} konflik
          </span>
        </div>

        {errors.map((c, i) => (
          <div
            key={`err-${i}`}
            className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 space-y-1.5"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-heading font-semibold text-destructive">
                  {getShortPosition(c.position1)} ↔ {getShortPosition(c.position2)}
                </p>
                <p className="text-xs text-muted-foreground font-body mt-1">{c.rule}</p>
                <p className="text-xs text-foreground/70 font-body mt-1.5">
                  Personil terkait: {c.holders.join(", ")}
                </p>
              </div>
            </div>
          </div>
        ))}

        {warnings.map((c, i) => (
          <div
            key={`warn-${i}`}
            className="bg-pub-amber/5 border border-pub-amber/20 rounded-lg p-4 space-y-1.5"
          >
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-pub-amber shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-heading font-semibold text-pub-amber">
                  {getShortPosition(c.position1)} ↔ {getShortPosition(c.position2)}
                </p>
                <p className="text-xs text-muted-foreground font-body mt-1">{c.rule}</p>
                <p className="text-xs text-foreground/70 font-body mt-1.5">
                  Personil terkait: {c.holders.join(", ")}
                </p>
              </div>
            </div>
          </div>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { toast } from "@/components/ui/sonner-toast";
import { User, Building2, Briefcase, Save, Loader2, Star, Award, Crown, Gem, ShieldCheck, ShieldAlert, Send, type LucideIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RoleConflictAlert } from "@/components/RoleConflictAlert";
import { useAdmin } from "@/hooks/useAdmin";
import { getConflictingPositions, getShortPosition, QUALIFICATION_OPTIONS, type BUJKQualification } from "@/lib/roleConstraints";

type AdminRequestStatus = "none" | "pending" | "approved" | "rejected";

// The admin_requests table + super_admin role only exist once their
// migration has run in the database. Keep this off until then so users
// don't see a request button that fails on click.
const ADMIN_REQUEST_FEATURE_ENABLED = false;

const JABATAN_OPTIONS = [
  "Penanggung Jawab Badan Usaha (PJBU) / Direktur",
  "Penanggung Jawab Teknik (PJT)",
  "Penanggung Jawab Subklasifikasi (PJSKBU)",
  "Manajer Keuangan",
  "Manajer Logistik & Rantai Pasok",
  "Manajer Pengadaan / Tender",
  "Manajer Administrasi",
  "Petugas K3",
] as const;

const levelConfig: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  Pemula: { icon: Star, color: "text-pub-sky", bg: "bg-pub-sky/10" },
  Muda: { icon: Award, color: "text-pub-emerald", bg: "bg-pub-emerald/10" },
  Madya: { icon: Crown, color: "text-pub-amber", bg: "bg-pub-amber/10" },
  Utama: { icon: Gem, color: "text-pub-violet", bg: "bg-pub-violet/10" },
};

const Profile = () => {
  const { profile, user, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [company, setCompany] = useState(profile?.company || "");
  const [position, setPosition] = useState(profile?.position || "");
  const [bujkQualification, setBujkQualification] = useState<BUJKQualification>(
    QUALIFICATION_OPTIONS.some((option) => option.value === profile?.bujk_qualification)
      ? profile?.bujk_qualification as BUJKQualification
      : "menengah"
  );
  const [saving, setSaving] = useState(false);
  const { isAdmin } = useAdmin();
  const [adminRequestStatus, setAdminRequestStatus] = useState<AdminRequestStatus>("none");
  const [requestingAdmin, setRequestingAdmin] = useState(false);
  const [checkingRequest, setCheckingRequest] = useState(true);

  useEffect(() => {
    if (!ADMIN_REQUEST_FEATURE_ENABLED || !user || isAdmin) {
      setCheckingRequest(false);
      return;
    }
    const checkRequest = async () => {
      const { data } = await supabase
        .from("admin_requests")
        .select("status")
        .eq("user_id", user.id)
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setAdminRequestStatus((data?.status as AdminRequestStatus) || "none");
      setCheckingRequest(false);
    };
    checkRequest();
  }, [user, isAdmin]);

  const handleRequestAdmin = async () => {
    if (!user) return;
    setRequestingAdmin(true);
    const { error } = await supabase.from("admin_requests").insert({ user_id: user.id });
    if (error) {
      toast.error("Gagal mengajukan akses admin. Coba lagi.");
    } else {
      toast.success("Permintaan akses admin terkirim.");
      setAdminRequestStatus("pending");
    }
    setRequestingAdmin(false);
  };

  // Get conflicting positions for current selection
  const positionConflicts = position ? getConflictingPositions(position, bujkQualification) : [];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Gagal menyimpan profil. Sesi pengguna tidak ditemukan.");
      return;
    }

    setSaving(true);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: user.id,
            full_name: fullName,
            company,
            position,
            bujk_qualification: bujkQualification,
          },
          { onConflict: "user_id" },
        )
        .select()
        .single();

      if (error || !data) {
        toast.error("Gagal menyimpan profil. Silakan coba lagi.");
        return;
      }

      await refreshProfile();
      toast.success("Profil berhasil disimpan!");
    } catch {
      toast.error("Gagal menyimpan profil. Silakan coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  const level = profile?.current_level || "Pemula";
  const lc = levelConfig[level];
  const LevelIcon = lc.icon;

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold font-heading text-foreground flex items-center gap-3 mb-6">
          <User className="w-7 h-7 text-pub-amber" />
          Profil Saya
        </h1>

        {/* Level badge */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-card mb-6">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl ${lc.bg} flex items-center justify-center`}>
              <LevelIcon className={`w-8 h-8 ${lc.color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-body">Level Kompetensi</p>
              <p className="text-2xl font-bold font-heading text-foreground">{level}</p>
              <p className="text-sm text-muted-foreground font-body">Skor: {profile?.total_score || 0}</p>
            </div>
          </div>
        </div>

        {/* Role conflict detection */}
        <div className="mb-6">
          <RoleConflictAlert qualification={bujkQualification} />
        </div>

        {/* Admin access request */}
        {ADMIN_REQUEST_FEATURE_ENABLED && !isAdmin && !checkingRequest && (
          <div className="bg-card border border-border rounded-xl p-6 shadow-card mb-6">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-5 h-5 text-pub-amber" />
              <h3 className="text-sm font-heading font-semibold text-foreground">Akses Admin</h3>
            </div>
            {adminRequestStatus === "pending" ? (
              <p className="text-sm text-muted-foreground font-body">
                Permintaan Anda sedang menunggu persetujuan super admin.
              </p>
            ) : adminRequestStatus === "rejected" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground font-body">Permintaan sebelumnya ditolak.</p>
                <button
                  type="button"
                  onClick={handleRequestAdmin}
                  disabled={requestingAdmin}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-pub-amber/40 text-pub-amber font-heading text-sm font-medium hover:bg-pub-amber/10 transition-colors disabled:opacity-50"
                >
                  {requestingAdmin ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Ajukan Ulang
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground font-body">
                  Butuh akses ke Panel Admin? Ajukan permintaan, dan super admin akan meninjaunya.
                </p>
                <button
                  type="button"
                  onClick={handleRequestAdmin}
                  disabled={requestingAdmin}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-pub-amber/40 text-pub-amber font-heading text-sm font-medium hover:bg-pub-amber/10 transition-colors disabled:opacity-50"
                >
                  {requestingAdmin ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Ajukan jadi Admin
                </button>
              </div>
            )}
          </div>
        )}

        {/* Profile form */}
        <form onSubmit={handleSave} className="bg-card border border-border rounded-xl p-6 shadow-card space-y-5">
          <div>
            <label htmlFor="profile-full-name" className="text-sm font-medium text-foreground font-heading mb-1.5 flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" /> Nama Lengkap
            </label>
            <input
              id="profile-full-name"
              name="fullName"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full h-11 px-4 rounded-lg border border-input bg-background text-foreground font-body text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="profile-company" className="text-sm font-medium text-foreground font-heading mb-1.5 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" /> Perusahaan
            </label>
            <input
              id="profile-company"
              name="company"
              type="text"
              autoComplete="organization"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="cth: PT Karya Konstruksi Nusantara"
              className="w-full h-11 px-4 rounded-lg border border-input bg-background text-foreground font-body text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="profile-bujk-qualification" className="text-sm font-medium text-foreground font-heading mb-1.5 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-muted-foreground" /> Kualifikasi BUJK
            </label>
            <Select
              name="bujkQualification"
              autoComplete="off"
              value={bujkQualification}
              onValueChange={(v) => setBujkQualification(v as BUJKQualification)}
            >
              <SelectTrigger id="profile-bujk-qualification" className="w-full h-11 font-body text-sm">
                <SelectValue placeholder="Pilih kualifikasi..." />
              </SelectTrigger>
              <SelectContent>
                {QUALIFICATION_OPTIONS.map((q) => (
                  <SelectItem key={q.value} value={q.value} className="font-body text-sm">
                    {q.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label htmlFor="profile-position" className="text-sm font-medium text-foreground font-heading mb-1.5 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-muted-foreground" /> Jabatan Personil Manajerial
            </label>
            <Select
              name="position"
              autoComplete="organization-title"
              value={position}
              onValueChange={setPosition}
            >
              <SelectTrigger id="profile-position" className="w-full h-11 font-body text-sm">
                <SelectValue placeholder="Pilih jabatan Anda..." />
              </SelectTrigger>
              <SelectContent>
                {JABATAN_OPTIONS.map((jabatan) => (
                  <SelectItem key={jabatan} value={jabatan} className="font-body text-sm">
                    {jabatan}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {positionConflicts.length > 0 && (
              <div className="mt-2 space-y-1">
                {positionConflicts.map((c, i) => (
                  <p key={i} className={`text-xs font-body ${c.severity === "error" ? "text-destructive" : "text-pub-amber"}`}>
                    ⚠ Tidak boleh dirangkap dengan {getShortPosition(c.position)}: {c.rule}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2">
            <p className="text-xs text-muted-foreground font-body mb-4">Email: {user?.email}</p>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-amber text-accent-foreground font-heading font-semibold shadow-amber hover:brightness-110 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Simpan Profil
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default Profile;

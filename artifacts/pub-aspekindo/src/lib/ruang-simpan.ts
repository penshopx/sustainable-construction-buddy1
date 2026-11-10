import { supabase } from "@/integrations/supabase/client";
import type { VaultWorkspace } from "@workspace/api-client-react";
import { toast } from "@/components/ui/sonner-toast";

export async function loadBusinessProfile() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sesi PUB tidak tersedia.");
  const response = await fetch("/api/ruang-simpan/workspace", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store", signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Profil perusahaan dari Ruang Simpan belum dapat dimuat.");
  return (await response.json() as VaultWorkspace).profile;
}

export async function canonicalCompanies<T extends { user_id: string; company: string }>(rows: T[]): Promise<T[]> {
  const names = new Map<string, string>();
  try {
    const ids = [...new Set(rows.map(row => row.user_id))];
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error();
    for (let i = 0; i < ids.length; i += 100) {
      const response = await fetch("/api/ruang-simpan/company-names", {
        method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: ids.slice(i, i + 100) }), signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error();
      const data = await response.json() as { companies: { userId: string; name: string }[] };
      data.companies.forEach(company => names.set(company.userId, company.name));
    }
  } catch { toast.error("Nama perusahaan Ruang Simpan belum lengkap. Data lama tidak dipakai sebagai pengganti."); }
  // An uninitialized workspace is not evidence that legacy company data is
  // current. No silent fallback to profiles.company.
  return rows.map(row => ({ ...row, company: names.get(row.user_id) ?? "" }));
}

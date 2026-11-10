import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Check, X, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner-toast";

interface AdminRequestRow {
  id: string;
  user_id: string;
  status: string;
  requested_at: string;
  full_name: string | null;
  company: string | null;
}

export default function AdminRequests() {
  const [requests, setRequests] = useState<AdminRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    const { data: reqData } = await supabase
      .from("admin_requests")
      .select("id, user_id, status, requested_at")
      .order("requested_at", { ascending: false });

    if (!reqData || reqData.length === 0) {
      setRequests([]);
      setLoading(false);
      return;
    }

    const userIds = reqData.map((r) => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, company")
      .in("user_id", userIds);

    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
    setRequests(
      reqData.map((r) => ({
        ...r,
        full_name: profileMap.get(r.user_id)?.full_name || null,
        company: profileMap.get(r.user_id)?.company || null,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleReview = async (id: string, approve: boolean) => {
    setActingId(id);
    const { error } = await supabase.rpc("approve_admin_request", {
      _request_id: id,
      _approve: approve,
    });
    if (error) {
      toast.error(approve ? "Gagal menyetujui permintaan." : "Gagal menolak permintaan.");
    } else {
      toast.success(approve ? "Admin baru disetujui." : "Permintaan ditolak.");
      await fetchRequests();
    }
    setActingId(null);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Disetujui</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Ditolak</Badge>;
      default:
        return <Badge className="bg-pub-amber/10 text-pub-amber border border-pub-amber/30">Menunggu</Badge>;
    }
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-heading text-foreground flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-accent" /> Permintaan Akses Admin
        </h2>
        <p className="text-sm text-muted-foreground">{pendingCount} permintaan menunggu persetujuan</p>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Perusahaan</TableHead>
              <TableHead>Diajukan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Memuat...</TableCell></TableRow>
            ) : requests.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Belum ada permintaan</TableCell></TableRow>
            ) : (
              requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.full_name || "(Belum diisi)"}</TableCell>
                  <TableCell>{r.company || "-"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(r.requested_at).toLocaleDateString("id-ID")}
                  </TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell className="text-right">
                    {r.status === "pending" ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actingId === r.id}
                          onClick={() => handleReview(r.id, true)}
                          className="text-green-700 border-green-300 hover:bg-green-50"
                        >
                          {actingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actingId === r.id}
                          onClick={() => handleReview(r.id, false)}
                          className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        >
                          {actingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

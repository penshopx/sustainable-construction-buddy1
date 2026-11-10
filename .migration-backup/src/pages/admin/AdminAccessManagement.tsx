import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search, Shield, ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AdminDirectoryRow = {
  user_id: string;
  email: string;
  full_name: string;
  company: string;
  is_admin: boolean;
  is_super_admin: boolean;
};

type RoleAction = "grant" | "revoke";

const BOOTSTRAP_EMAIL = "penshopx@gmail.com";

export default function AdminAccessManagement() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<AdminDirectoryRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [actingUserId, setActingUserId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ account: AdminDirectoryRow; action: RoleAction } | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_admin_directory");
    if (error) {
      toast({ title: "Daftar akun gagal dimuat", description: error.message, variant: "destructive" });
      setAccounts([]);
    } else {
      setAccounts(data ?? []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const filteredAccounts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return accounts;
    return accounts.filter((account) =>
      [account.email, account.full_name, account.company]
        .some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [accounts, query]);

  const adminCount = accounts.filter((account) => account.is_admin && !account.is_super_admin).length;

  const applyRoleChange = async () => {
    if (!confirmation) return;
    const { account, action } = confirmation;
    setActingUserId(account.user_id);
    const { error } = action === "grant"
      ? await supabase.rpc("grant_admin_role", { _target_user: account.user_id })
      : await supabase.rpc("revoke_admin_role", { _target_user: account.user_id });
    setActingUserId(null);
    setConfirmation(null);
    if (error) {
      toast({
        title: action === "grant" ? "Akses admin gagal diberikan" : "Akses admin gagal dicabut",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: action === "grant" ? "Akses admin diberikan" : "Akses admin dicabut" });
    await loadAccounts();
  };

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl bg-hero p-6 text-primary-foreground md:p-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10">Akses terbatas Super Admin</Badge>
            <h1 className="mt-3 flex items-center gap-2 text-3xl font-extrabold font-heading">
              <ShieldCheck className="h-7 w-7 text-pub-amber" /> Kelola Akses Admin
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-primary-foreground/75">
              Berikan akses Admin Operasional kepada akun yang bertugas mengelola kegiatan, LMS, dan data aplikasi.
            </p>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 px-5 py-4">
            <p className="text-xs text-primary-foreground/65">Super Admin utama</p>
            <p className="mt-1 font-semibold">{BOOTSTRAP_EMAIL}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Total akun</p><p className="mt-1 text-2xl font-bold">{accounts.length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Admin operasional</p><p className="mt-1 text-2xl font-bold">{adminCount}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Hak super admin</p><p className="mt-1 text-2xl font-bold">{accounts.filter((account) => account.is_super_admin).length}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-pub-sky" /> Akun dan hak akses</CardTitle>
            <CardDescription>Hanya Super Admin utama yang dapat mengubah role.</CardDescription>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Cari nama, email, atau BUJK..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Akun pengguna</TableHead>
                <TableHead>Perusahaan</TableHead>
                <TableHead>Hak akses</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="py-12 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
              ) : filteredAccounts.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="py-12 text-center text-muted-foreground">{query ? "Tidak ada akun yang cocok." : "Belum ada akun pengguna."}</TableCell></TableRow>
              ) : filteredAccounts.map((account) => (
                <TableRow key={account.user_id}>
                  <TableCell className="min-w-[230px]">
                    <p className="font-semibold">{account.full_name || "Nama belum diisi"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{account.email}</p>
                  </TableCell>
                  <TableCell className="min-w-[160px]">{account.company || "-"}</TableCell>
                  <TableCell>
                    {account.is_super_admin ? (
                      <Badge className="gap-1 border-pub-amber/30 bg-pub-amber/10 text-pub-amber hover:bg-pub-amber/10"><ShieldCheck className="h-3 w-3" /> Super Admin utama</Badge>
                    ) : account.is_admin ? (
                      <Badge className="gap-1 border-pub-sky/30 bg-pub-sky/10 text-pub-sky hover:bg-pub-sky/10"><Shield className="h-3 w-3" /> Admin Operasional</Badge>
                    ) : (
                      <Badge variant="outline">Pengguna</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {account.is_super_admin ? (
                      <span className="text-xs text-muted-foreground">Akses permanen</span>
                    ) : account.is_admin ? (
                      <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirmation({ account, action: "revoke" })} disabled={actingUserId === account.user_id}>
                        {actingUserId === account.user_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserMinus className="mr-2 h-4 w-4" />} Cabut akses
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setConfirmation({ account, action: "grant" })} disabled={actingUserId === account.user_id}>
                        <UserPlus className="mr-2 h-4 w-4" /> Jadikan admin
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(confirmation)} onOpenChange={(open) => !open && setConfirmation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation?.action === "grant" ? "Berikan akses Admin Operasional?" : "Cabut akses Admin Operasional?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.action === "grant"
                ? `Akun ${confirmation?.account.email} akan dapat mengakses dan mengelola fitur administrasi aplikasi.`
                : `Akun ${confirmation?.account.email} tidak lagi dapat membuka panel administrasi setelah akses dicabut.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void applyRoleChange(); }}>
              {confirmation?.action === "grant" ? "Berikan akses" : "Cabut akses"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
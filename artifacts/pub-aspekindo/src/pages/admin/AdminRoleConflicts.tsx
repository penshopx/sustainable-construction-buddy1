import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { detectConflicts, getShortPosition, QUALIFICATION_OPTIONS, type BUJKQualification } from "@/lib/roleConstraints";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle, Building2, Loader2, ShieldAlert, Download } from "lucide-react";
import html2pdf from "html2pdf.js";
import { toast } from "@/hooks/use-toast";

interface ProfileRow {
  user_id: string;
  full_name: string;
  company: string;
  position: string;
  bujk_qualification: string;
}

interface CompanyConflict {
  company: string;
  qualification: BUJKQualification;
  members: ProfileRow[];
  conflicts: ReturnType<typeof detectConflicts>;
}

function buildPdfHtml(data: CompanyConflict[], totalConflicts: number, companiesWithConflicts: number) {
  const date = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  let html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; padding: 10px;">
      <h1 style="text-align:center; font-size:18px; margin-bottom:4px;">LAPORAN KONFLIK JABATAN</h1>
      <p style="text-align:center; font-size:12px; color:#666; margin-top:0;">Tanggal: ${date}</p>
      <hr style="border:none; border-top:2px solid #1a1a1a; margin:12px 0;" />

      <table style="width:100%; border-collapse:collapse; margin-bottom:16px; font-size:12px;">
        <tr>
          <td style="padding:6px 10px; border:1px solid #ddd; background:#f5f5f5; font-weight:bold;">Total Perusahaan</td>
          <td style="padding:6px 10px; border:1px solid #ddd; text-align:center;">${data.length}</td>
          <td style="padding:6px 10px; border:1px solid #ddd; background:#f5f5f5; font-weight:bold;">Perusahaan Bermasalah</td>
          <td style="padding:6px 10px; border:1px solid #ddd; text-align:center; color:${companiesWithConflicts > 0 ? '#dc2626' : '#16a34a'};">${companiesWithConflicts}</td>
          <td style="padding:6px 10px; border:1px solid #ddd; background:#f5f5f5; font-weight:bold;">Total Konflik</td>
          <td style="padding:6px 10px; border:1px solid #ddd; text-align:center; color:${totalConflicts > 0 ? '#dc2626' : '#16a34a'};">${totalConflicts}</td>
        </tr>
      </table>
  `;

  for (const company of data) {
    const qualLabel = QUALIFICATION_OPTIONS.find(q => q.value === company.qualification)?.label || company.qualification;
    const status = company.conflicts.length > 0
      ? `<span style="color:#dc2626; font-weight:bold;">${company.conflicts.length} Konflik Terdeteksi</span>`
      : `<span style="color:#16a34a; font-weight:bold;">✓ Aman</span>`;

    html += `
      <div style="margin-bottom:16px; page-break-inside:avoid;">
        <h2 style="font-size:14px; margin-bottom:4px; border-bottom:1px solid #ddd; padding-bottom:4px;">
          ${company.company} <span style="font-weight:normal; font-size:11px; color:#666;">(${qualLabel})</span>
          — ${status}
        </h2>
        <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:8px;">
          <thead>
            <tr style="background:#f5f5f5;">
              <th style="padding:5px 8px; border:1px solid #ddd; text-align:left;">No</th>
              <th style="padding:5px 8px; border:1px solid #ddd; text-align:left;">Nama</th>
              <th style="padding:5px 8px; border:1px solid #ddd; text-align:left;">Jabatan</th>
            </tr>
          </thead>
          <tbody>
            ${company.members.map((m, i) => `
              <tr>
                <td style="padding:4px 8px; border:1px solid #ddd;">${i + 1}</td>
                <td style="padding:4px 8px; border:1px solid #ddd;">${m.full_name || "(Belum diisi)"}</td>
                <td style="padding:4px 8px; border:1px solid #ddd;">${getShortPosition(m.position)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
    `;

    if (company.conflicts.length > 0) {
      html += `<div style="font-size:11px;">`;
      for (const c of company.conflicts) {
        const color = c.severity === "error" ? "#dc2626" : "#d97706";
        html += `
          <div style="padding:6px 8px; margin-bottom:4px; border-left:3px solid ${color}; background:${c.severity === "error" ? "#fef2f2" : "#fffbeb"};">
            <strong style="color:${color};">⚠ ${getShortPosition(c.position1)} ↔ ${getShortPosition(c.position2)}</strong><br/>
            <span>${c.rule}</span>
          </div>
        `;
      }
      html += `</div>`;
    }

    html += `</div>`;
  }

  html += `
      <hr style="border:none; border-top:1px solid #ddd; margin-top:20px;" />
      <p style="font-size:10px; color:#999; text-align:center;">
        Laporan ini dihasilkan secara otomatis oleh sistem PUB ASPEKINDO — ${date}
      </p>
    </div>
  `;

  return html;
}

export default function AdminRoleConflicts() {
  const [data, setData] = useState<CompanyConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, company, position, bujk_qualification")
        .neq("position", "")
        .neq("company", "");

      if (!profiles) { setLoading(false); return; }

      const byCompany = new Map<string, ProfileRow[]>();
      for (const p of profiles as ProfileRow[]) {
        const key = p.company.trim().toLowerCase();
        if (!byCompany.has(key)) byCompany.set(key, []);
        byCompany.get(key)!.push(p);
      }

      const results: CompanyConflict[] = [];
      for (const [, members] of byCompany) {
        if (members.length < 1) continue;
        const positions = members.map(m => m.position);
        const qual = (members[0].bujk_qualification || "menengah") as BUJKQualification;
        const conflicts = detectConflicts(positions, qual);
        results.push({
          company: members[0].company,
          qualification: qual,
          members,
          conflicts,
        });
      }

      results.sort((a, b) => b.conflicts.length - a.conflicts.length);
      setData(results);
      setLoading(false);
    };
    fetchData();
  }, []);

  const totalConflicts = data.reduce((sum, c) => sum + c.conflicts.length, 0);
  const companiesWithConflicts = data.filter(c => c.conflicts.length > 0).length;

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const htmlContent = buildPdfHtml(data, totalConflicts, companiesWithConflicts);
      const container = document.createElement("div");
      container.innerHTML = htmlContent;
      document.body.appendChild(container);

      const filename = `Laporan_Konflik_Jabatan_${new Date().toISOString().slice(0, 10)}.pdf`;
      const pdfOptions = {
        margin: [15, 15, 15, 15] as [number, number, number, number],
        filename,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      };
      await html2pdf().set(pdfOptions).from(container).save();

      document.body.removeChild(container);
      toast({ title: "PDF berhasil diunduh", description: filename });
    } catch (err) {
      toast({ title: "Gagal mengunduh PDF", variant: "destructive" });
    }
    setExporting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with export button */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div />
        <Button onClick={handleExportPdf} disabled={exporting || data.length === 0} className="gap-2">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Export PDF
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Building2 className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{data.length}</p>
              <p className="text-sm text-muted-foreground">Total Perusahaan</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-destructive" />
            <div>
              <p className="text-2xl font-bold">{companiesWithConflicts}</p>
              <p className="text-sm text-muted-foreground">Perusahaan Bermasalah</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold">{totalConflicts}</p>
              <p className="text-sm text-muted-foreground">Total Konflik</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Company conflict list */}
      {data.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Belum ada data perusahaan dengan jabatan terisi.
          </CardContent>
        </Card>
      ) : (
        data.map((company) => (
          <Card key={company.company}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  {company.company}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {QUALIFICATION_OPTIONS.find(q => q.value === company.qualification)?.label || company.qualification}
                  </Badge>
                  {company.conflicts.length > 0 ? (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {company.conflicts.length} konflik
                    </Badge>
                  ) : (
                    <Badge className="gap-1 bg-emerald-500/90 hover:bg-emerald-500">
                      <CheckCircle className="w-3 h-3" />
                      Aman
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Jabatan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {company.members.map((m) => (
                    <TableRow key={m.user_id}>
                      <TableCell className="font-medium">{m.full_name || "(Belum diisi)"}</TableCell>
                      <TableCell>{getShortPosition(m.position)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {company.conflicts.length > 0 && (
                <div className="space-y-2">
                  {company.conflicts.map((c, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border text-sm ${
                        c.severity === "error"
                          ? "bg-destructive/10 border-destructive/30 text-destructive"
                          : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      <div className="font-medium flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        {getShortPosition(c.position1)} ↔ {getShortPosition(c.position2)}
                      </div>
                      <p className="ml-6">{c.rule}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

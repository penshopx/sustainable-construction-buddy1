import html2pdf from "html2pdf.js";
import type { PubProgram } from "@/hooks/usePrograms";
import type { PubProgramParticipant } from "@/hooks/useParticipants";

const statusLabel: Record<string, string> = {
  registered: "Terdaftar",
  attended: "Hadir",
  absent: "Tidak Hadir",
};

function fmtDate(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export function exportParticipantPdf(program: PubProgram, participants: PubProgramParticipant[]) {
  const attended = participants.filter((p) => p.attendance_status === "attended").length;
  const absent = participants.filter((p) => p.attendance_status === "absent").length;
  const registered = participants.filter((p) => p.attendance_status === "registered").length;

  const rows = participants
    .map(
      (p, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${p.full_name || "-"}</td>
      <td>${p.company || "-"}</td>
      <td>${p.position || "-"}</td>
      <td>${p.email || "-"}</td>
      <td>${p.phone || "-"}</td>
      <td style="text-align:center;font-weight:600;color:${p.attendance_status === "attended" ? "#10b981" : p.attendance_status === "absent" ? "#ef4444" : "#f59e0b"}">${statusLabel[p.attendance_status] || p.attendance_status}</td>
      <td>${p.notes || "-"}</td>
    </tr>`
    )
    .join("");

  const html = `
<div style="font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;padding:12px;max-width:100%">
  <div style="text-align:center;margin-bottom:18px">
    <h2 style="margin:0;font-size:16px;color:#0ea5e9">LAPORAN KEHADIRAN PESERTA</h2>
    <h3 style="margin:4px 0 0;font-size:14px">${program.title}</h3>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:14px">
    <tr>
      <td style="padding:3px 6px;width:120px;font-weight:600">Kategori</td>
      <td style="padding:3px 6px;text-transform:capitalize">${program.category}</td>
      <td style="padding:3px 6px;width:120px;font-weight:600">Lokasi</td>
      <td style="padding:3px 6px">${program.location || "-"}</td>
    </tr>
    <tr>
      <td style="padding:3px 6px;font-weight:600">Tanggal Mulai</td>
      <td style="padding:3px 6px">${fmtDate(program.start_date)}</td>
      <td style="padding:3px 6px;font-weight:600">Tanggal Selesai</td>
      <td style="padding:3px 6px">${fmtDate(program.end_date)}</td>
    </tr>
  </table>

  <div style="display:flex;gap:10px;margin-bottom:14px">
    <div style="flex:1;text-align:center;padding:8px;background:#f0f9ff;border-radius:6px">
      <div style="font-size:18px;font-weight:700;color:#0ea5e9">${participants.length}</div>
      <div style="font-size:9px;color:#64748b">Total Peserta</div>
    </div>
    <div style="flex:1;text-align:center;padding:8px;background:#f0fdf4;border-radius:6px">
      <div style="font-size:18px;font-weight:700;color:#10b981">${attended}</div>
      <div style="font-size:9px;color:#64748b">Hadir</div>
    </div>
    <div style="flex:1;text-align:center;padding:8px;background:#fef2f2;border-radius:6px">
      <div style="font-size:18px;font-weight:700;color:#ef4444">${absent}</div>
      <div style="font-size:9px;color:#64748b">Tidak Hadir</div>
    </div>
    <div style="flex:1;text-align:center;padding:8px;background:#fffbeb;border-radius:6px">
      <div style="font-size:18px;font-weight:700;color:#f59e0b">${registered}</div>
      <div style="font-size:9px;color:#64748b">Terdaftar</div>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:9px">
    <thead>
      <tr style="background:#0ea5e9;color:#fff">
        <th style="padding:5px 4px;text-align:center;width:28px">No</th>
        <th style="padding:5px 4px;text-align:left">Nama</th>
        <th style="padding:5px 4px;text-align:left">Perusahaan</th>
        <th style="padding:5px 4px;text-align:left">Jabatan</th>
        <th style="padding:5px 4px;text-align:left">Email</th>
        <th style="padding:5px 4px;text-align:left">Telepon</th>
        <th style="padding:5px 4px;text-align:center">Status</th>
        <th style="padding:5px 4px;text-align:left">Catatan</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="8" style="text-align:center;padding:12px;color:#94a3b8">Belum ada peserta</td></tr>'}
    </tbody>
  </table>

  <div style="margin-top:16px;font-size:8px;color:#94a3b8;text-align:right">
    Dicetak pada ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
  </div>
</div>`;

  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);

  html2pdf()
    .set({
      margin: [8, 8, 8, 8],
      filename: `Laporan-Kehadiran-${program.title.replace(/\s+/g, "-")}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
    })
    .from(container)
    .save()
    .then(() => document.body.removeChild(container));
}

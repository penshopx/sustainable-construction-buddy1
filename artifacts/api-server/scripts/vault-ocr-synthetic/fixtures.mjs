import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";

// Rendering recipe deliberately does not import the independent scoring oracle.
export async function generateFixtures(dir) {
  const path = name => fileURLToPath(new URL(name, dir));
  const convert = args => execFileSync("convert", args, { stdio: "pipe", timeout: 15_000 });
  const draw = (name, lines) => convert([
    "-size", "1400x900", "xc:white", "-font", "DejaVu-Sans", "-fill", "black", "-pointsize", "36",
    ...lines.flatMap((line, i) => ["-annotate", `+65+${100 + i * 85}`, line]), path(name),
  ]);
  draw("certificate.png", [
    "SERTIFIKAT SINTETIS", "Nomor UJI-7319", "Nilai Rp 815 juta",
    "Pelatihan keselamatan kerja telah selesai.", "Dokumen ini bukan data anggota.", "AKHIR SERTIFIKAT",
  ]);
  draw("indonesia.png", [
    "CATATAN PEMERIKSAAN SINTETIS", "Pekerjaan: pemeliharaan jembatan",
    "Pengujian dilaksanakan pada 17 Agustus 2026.",
    "Persyaratan: keselamatan, kelayakan, dan ketelitian.",
    "Biaya pemeriksaan Rp 1.275.000.", "Status: belum disetujui.", "AKHIR CATATAN",
  ]);
  // Visible grid and separate cells, not an embedded text layer.
  convert([
    "-size", "1400x900", "xc:white", "-font", "DejaVu-Sans", "-fill", "black", "-pointsize", "36",
    "-annotate", "+60+90", "TABEL ANGGARAN SINTETIS",
    "-stroke", "black", "-strokewidth", "2", "-fill", "none",
    "-draw", "rectangle 50,150 1350,550 line 50,250 1350,250 line 50,350 1350,350 line 50,450 1350,450 line 650,150 650,550 line 900,150 900,550",
    "-stroke", "none", "-fill", "black",
    "-annotate", "+75+215", "Uraian", "-annotate", "+680+215", "Jumlah", "-annotate", "+940+215", "Nilai rupiah",
    "-annotate", "+75+315", "Semen", "-annotate", "+680+315", "12", "-annotate", "+940+315", "780.000",
    "-annotate", "+75+415", "Baja", "-annotate", "+680+415", "7", "-annotate", "+940+415", "1.925.000",
    "-annotate", "+75+515", "Pasir", "-annotate", "+680+515", "5", "-annotate", "+940+515", "625.000",
    "-annotate", "+60+650", "AKHIR TABEL", path("table.png"),
  ]);
  // Perspective warp simulates an oblique camera, with mild rotation/blur/JPEG loss.
  convert([path("indonesia.png"), "-virtual-pixel", "white", "-distort", "Perspective",
    "0,0 100,60 1400,0 1320,0 0,900 0,820 1400,900 1400,900",
    "-background", "white", "-rotate", "7", "-blur", "0x0.35", "-quality", "72", path("tilted.jpg")]);
  convert([path("indonesia.png"), "-resize", "560x360!", "-blur", "0x0.25", "-quality", "45", path("low-resolution.jpg")]);
  const pdf = await PDFDocument.create();
  for (const name of ["certificate.png", "indonesia.png", "table.png"]) {
    const image = await pdf.embedPng(await readFile(path(name)));
    const page = pdf.addPage([700, 450]);
    page.drawImage(image, { x: 0, y: 0, width: 700, height: 450 });
  }
  await writeFile(path("multipage.pdf"), await pdf.save());
  return [
    { id: "baseline", type: "PNG", path: path("certificate.png"), reference: "certificate" },
    { id: "indonesia", type: "PNG", path: path("indonesia.png"), reference: "indonesia" },
    { id: "tilted", type: "JPG", path: path("tilted.jpg"), reference: "indonesia" },
    { id: "low-resolution", type: "JPG", path: path("low-resolution.jpg"), reference: "indonesia" },
    { id: "table", type: "PNG", path: path("table.png"), reference: "table" },
    { id: "multipage", type: "PDF", path: path("multipage.pdf"), reference: "multipage", pageRange: { start: 1, end: 3 } },
    { id: "selected-pages", type: "PDF", path: path("multipage.pdf"), reference: "selected", pageRange: { start: 2, end: 3 } },
  ];
}

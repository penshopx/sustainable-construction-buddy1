import type { Certificate } from "@/components/certificates/CertificateHistoryTable";
import logoPub from "@/assets/logo-pub-new.png";
import logoAspekindo from "@/assets/logo-aspekindo.png";
import logoLsbuki from "@/assets/logo-lsbuki.png";
import logoLpjk from "@/assets/logo-lpjk.png";

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const drawLogo = async (
  ctx: CanvasRenderingContext2D,
  src: string,
  x: number,
  y: number,
  maxW: number,
  maxH: number
): Promise<number> => {
  try {
    const img = await loadImage(src);
    const ratio = Math.min(maxW / img.width, maxH / img.height);
    const w = img.width * ratio, h = img.height * ratio;
    ctx.drawImage(img, x, y, w, h);
    return w;
  } catch {
    return 0;
  }
};

export async function downloadCertificateAsPng(cert: Certificate) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const W = 1200, H = 850;
  canvas.width = W;
  canvas.height = H;

  const colors: Record<string, string> = {
    Pemula: "#10B981", Muda: "#3B82F6", Madya: "#8B5CF6", Utama: "#F59E0B",
  };
  const color = colors[cert.level] || "#3B82F6";

  // Background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  // Borders
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.strokeRect(20, 20, W - 40, H - 40);
  ctx.strokeStyle = color + "40";
  ctx.lineWidth = 2;
  ctx.strokeRect(35, 35, W - 70, H - 70);

  // Logo dimensions
  const logoMaxH = 60, logoMaxW = 100;
  const logoY = 50;
  const gap = 12;

  // Left logos: PUB, ASPEKINDO, LSBUKI
  let leftX = 60;
  const w1 = await drawLogo(ctx, logoPub, leftX, logoY, logoMaxW, logoMaxH);
  leftX += w1 + gap;
  const w2 = await drawLogo(ctx, logoAspekindo, leftX, logoY, logoMaxW, logoMaxH);
  leftX += w2 + gap;
  await drawLogo(ctx, logoLsbuki, leftX, logoY, logoMaxW, logoMaxH);

  // Right logo: LPJK-PU
  const rightX = W - 60 - logoMaxW;
  await drawLogo(ctx, logoLpjk, rightX, logoY, logoMaxW, logoMaxH);

  // Title
  ctx.textAlign = "center";
  ctx.fillStyle = color;
  ctx.font = "bold 30px Arial, sans-serif";
  ctx.fillText("SERTIFIKAT PELATIHAN PERSONIL MANAJERIAL", W / 2, 130);
  ctx.font = "bold 36px Arial, sans-serif";
  ctx.fillText(`BUJK — ${cert.company || ""}`, W / 2, 165);

  // Level - right below title
  ctx.fillStyle = "#6B7280";
  ctx.font = "18px Arial, sans-serif";
  ctx.fillText(`Level: ${cert.level}`, W / 2, 190);

  // Legal basis - compact styled box (3 lines)
  const boxX = 120, boxW = W - 240, boxY = 205, boxH = 50;
  ctx.fillStyle = color + "10";
  ctx.strokeStyle = color + "30";
  ctx.lineWidth = 1;
  const r = 6;
  ctx.beginPath();
  ctx.moveTo(boxX + r, boxY);
  ctx.lineTo(boxX + boxW - r, boxY);
  ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + r);
  ctx.lineTo(boxX + boxW, boxY + boxH - r);
  ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - r, boxY + boxH);
  ctx.lineTo(boxX + r, boxY + boxH);
  ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - r);
  ctx.lineTo(boxX, boxY + r);
  ctx.quadraticCurveTo(boxX, boxY, boxX + r, boxY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#4B5563";
  ctx.font = "italic 10px Arial, sans-serif";
  ctx.fillText("Berdasarkan UU No. 02/2017 tentang Jasa Konstruksi, Permen PU No. 7/2024 tentang PUB serta Permen PU No. 6/2025,", W / 2, boxY + 15);
  ctx.fillText("kegiatan PUB ASPEKINDO merupakan salah satu Persyaratan Perpanjangan SBU Jasa Konstruksi.", W / 2, boxY + 28);
  ctx.fillText("Atas partisipasi dalam kegiatan PUB ASPEKINDO, diberikan :", W / 2, boxY + 41);

  // Awarded to
  ctx.fillStyle = "#9CA3AF";
  ctx.font = "16px Arial, sans-serif";
  ctx.fillText("Diberikan kepada:", W / 2, 290);

  // Name
  ctx.fillStyle = "#111827";
  ctx.font = "bold 38px Arial, sans-serif";
  ctx.fillText(cert.full_name || "—", W / 2, 335);

  // Position
  if (cert.position) {
    ctx.fillStyle = "#6B7280";
    ctx.font = "18px Arial, sans-serif";
    ctx.fillText(cert.position, W / 2, 365);
  }

  // Description
  ctx.fillStyle = "#4B5563";
  ctx.font = "16px Arial, sans-serif";
  ctx.fillText("Telah menyelesaikan modul Pembelajaran sebagai Personil Manajerial BUJK :", W / 2, 410);

  // Module name
  ctx.fillStyle = "#111827";
  ctx.font = "bold 22px Arial, sans-serif";
  ctx.fillText(cert.module_name || "—", W / 2, 445);

  // Decorative line
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(350, 470);
  ctx.lineTo(850, 470);
  ctx.stroke();

  // Certificate number
  ctx.fillStyle = "#9CA3AF";
  ctx.font = "14px Arial, sans-serif";
  ctx.fillText(`No. ${cert.certificate_number}`, W / 2, 500);

  // Date
  ctx.fillText(
    `Diterbitkan pada ${new Date(cert.issued_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`,
    W / 2, 580
  );

  // Signatures
  const sigY = H - 150;
  const sigLineW = 180;
  const leftSigX = W / 2 - sigLineW - 40;
  const rightSigX = W / 2 + 40;

  // Left signature - name then line then title
  ctx.fillStyle = "#111827";
  ctx.font = "bold 13px Arial, sans-serif";
  ctx.fillText("Eduard Berman Hutagalung, ST", leftSigX + sigLineW / 2, sigY + 30);
  ctx.strokeStyle = "#D1D5DB";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(leftSigX, sigY + 40);
  ctx.lineTo(leftSigX + sigLineW, sigY + 40);
  ctx.stroke();
  ctx.fillStyle = "#6B7280";
  ctx.font = "11px Arial, sans-serif";
  ctx.fillText("Ketua PUB ASPEKINDO", leftSigX + sigLineW / 2, sigY + 55);

  // Right signature - name then line then title
  ctx.fillStyle = "#111827";
  ctx.font = "bold 13px Arial, sans-serif";
  ctx.fillText("Tumpal SP Sianipar, SE", rightSigX + sigLineW / 2, sigY + 30);
  ctx.strokeStyle = "#D1D5DB";
  ctx.beginPath();
  ctx.moveTo(rightSigX, sigY + 40);
  ctx.lineTo(rightSigX + sigLineW, sigY + 40);
  ctx.stroke();
  ctx.fillStyle = "#6B7280";
  ctx.font = "11px Arial, sans-serif";
  ctx.fillText("Ketua Umum DPN ASPEKINDO", rightSigX + sigLineW / 2, sigY + 55);

  // Footer
  ctx.fillStyle = "#D1D5DB";
  ctx.font = "12px Arial, sans-serif";
  ctx.fillText("Personil Manajerial BUJK — Konstruksi Indonesia", W / 2, H - 45);

  // Download
  const link = document.createElement("a");
  link.download = `Sertifikat-${cert.level}-${cert.certificate_number}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

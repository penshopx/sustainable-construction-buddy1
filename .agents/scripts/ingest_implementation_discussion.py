"""Index the supplied implementation slides using local OCR, never a remote provider.

Run this after ingest_lpjk_knowledge.py when rebuilding the shared corpus.
The original PDF remains in attached_assets; rendered images are temporary.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib
import json
import os
import re
import subprocess
import tempfile
import pymupdf as fitz

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "attached_assets/NEW_PK-2026-1._Implementasi_Permen_PU_6_OK_1793783111438.pdf"
CORPUS = ROOT / "artifacts/api-server/src/data/lpjk-knowledge.json"
CATALOG = ROOT / "artifacts/pub-aspekindo/src/data/lpjk-knowledge-catalog.json"


def extract(number):
    # Slides mix real text with screenshots: OCR the whole page, not just empty pages.
    with fitz.open(SOURCE) as pdf, tempfile.TemporaryDirectory() as directory:
        image = Path(directory) / "page.png"
        pdf[number].get_pixmap(matrix=fitz.Matrix(1.8, 1.8), alpha=False).save(image)
        result = subprocess.run(
            ["tesseract", str(image), "stdout", "-l", "ind+eng", "--psm", "3"],
            capture_output=True, check=True, timeout=120,
            env={**os.environ, "OMP_THREAD_LIMIT": "1"},
        )
        native = re.sub(r"[ \t]+", " ", pdf[number].get_text()).strip()
        ocr = result.stdout.decode("utf-8").strip()
        # Keep the native layer too: names or small labels can be lost by OCR.
        text = ocr
        if native and native not in ocr:
            text += "\n\n[Lapisan teks bawaan, dapat mengulang isi slide]\n" + native
        return {"page": number + 1, "text": text, "method": "local_ocr_and_text_layer"}


def main():
    with fitz.open(SOURCE) as pdf:
        count = len(pdf)
    with ThreadPoolExecutor(max_workers=4) as pool:
        pages = list(pool.map(extract, range(count)))
    metadata = dict(
        id="KB46",
        title="Materi Diskusi — Implementasi Permen PU Nomor 6 Tahun 2025",
        kind="paparan", fileName=SOURCE.name,
        sha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        pageCount=count, textPageCount=sum(bool(p["text"]) for p in pages),
        pagesNeedingReview=[p["page"] for p in pages if len(p["text"]) < 90],
        visualSummaryPages=[], format="pdf", lineCount=0, entryCount=0,
        note=(
            "Materi diskusi/paparan implementasi Permen PU Nomor 6 Tahun 2025, "
            "bukan naskah peraturan atau keputusan resmi dan bukan bukti status hukum terkini. "
            "Nama file PK-2026-1 tidak mengubah tahun peraturan pada sampul (2025). "
            "Teks diekstrak menggunakan OCR lokal bahasa Indonesia/Inggris dan lapisan teks bawaan; "
            "belum diverifikasi kata demi kata, dapat salah membaca angka, tabel, dan urutan kolom. "
            "Rujukan memakai nomor halaman PDF fisik 1–91; periksa gambar asli untuk rincian "
            "dan bandingkan dengan naskah peraturan KB19 sebelum keputusan resmi."
        ),
    )
    for path, record in [
        (CORPUS, {**metadata, "pages": pages, "lines": []}),
        (CATALOG, metadata),
    ]:
        data = json.loads(path.read_text())
        data["documents"] = [d for d in data["documents"] if d["id"] != metadata["id"]] + [record]
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(metadata, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()

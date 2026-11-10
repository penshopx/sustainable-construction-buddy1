"""Append the supplied BMD amendment without re-OCR or remote document transfer."""
from pathlib import Path
import hashlib
import json
import re
import pymupdf

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "attached_assets/Permendagri_No_7_Tahun_2024_OCR_1793788420273.pdf"
CORPUS = ROOT / "artifacts/api-server/src/data/lpjk-knowledge.json"
CATALOG = ROOT / "artifacts/pub-aspekindo/src/data/lpjk-knowledge-catalog.json"


def main():
    with pymupdf.open(SOURCE) as pdf:
        pages = [
            {"page": i + 1, "text": re.sub(r"[ \t]+", " ", page.get_text()).strip(),
             "method": "text_layer"}
            for i, page in enumerate(pdf)
        ]
    if len(pages) != 140 or not all(page["text"] for page in pages):
        raise ValueError("Unexpected page count or unreadable pages; review the supplied PDF.")
    if "MENTERI DALAM NEGERI" not in pages[0]["text"]:
        raise ValueError("Unexpected regulation identity.")
    metadata = dict(
        id="KB47",
        title="Permendagri Nomor 7 Tahun 2024 — Perubahan atas Permendagri Nomor 19 Tahun 2016 tentang Pedoman Pengelolaan Barang Milik Daerah",
        kind="peraturan_menteri", fileName=SOURCE.name,
        sha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        pageCount=len(pages), textPageCount=len(pages),
        pagesNeedingReview=[page["page"] for page in pages if len(page["text"]) < 90],
        visualSummaryPages=[], format="pdf", lineCount=0, entryCount=0,
        note=(
            "Naskah perubahan Permendagri 19/2016 tentang Pedoman Pengelolaan Barang Milik Daerah, "
            "bukan konsolidasi lengkap dan bukan Permen PUPR 7/2024 tentang PUB (KB18). "
            "Referensi tambahan khusus pengelolaan barang milik daerah; bukan pengganti regulasi PUB. "
            "Teks diambil dari lapisan teks PDF yang diunggah (nama berkas menyebut OCR), "
            "bukan OCR atau verifikasi baru. Dapat mengandung kesalahan OCR, angka, tabel, dan urutan kolom. "
            "Kutipan memakai nomor halaman PDF fisik 1–140. "
            "Periksa naskah asli dan regulasi dasar/perubahan terkait sebelum keputusan resmi; "
            "unggahan ini tidak membuktikan status hukum terkini."
        ),
    )
    for path, record in [
        (CORPUS, {**metadata, "pages": pages, "lines": []}),
        (CATALOG, metadata),
    ]:
        data = json.loads(path.read_text())
        other = [d for d in data["documents"] if d["id"] != metadata["id"]]
        if any(d["sha256"] == metadata["sha256"] for d in other):
            raise ValueError("This PDF already exists under another knowledge ID.")
        data["documents"] = other + [record]
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(metadata, ensure_ascii=False))


if __name__ == "__main__":
    main()

from pathlib import Path
import sys
import pymupdf

terms = (
    "LKUT",
    "Laporan Kegiatan Usaha Tahunan",
    "LSBU",
    "Lembaga Sertifikasi Badan Usaha",
    "Permen",
)

output_dir = Path(".agents/outputs/pdf-reference-pages")
output_dir.mkdir(parents=True, exist_ok=True)

for raw_path in sys.argv[1:]:
    path = Path(raw_path)
    doc = pymupdf.open(path)
    print(f"\n=== {path.name} ===")
    print(f"pages={doc.page_count} metadata={doc.metadata}")

    matches = []
    for page_number, page in enumerate(doc):
        text = page.get_text("text")
        normalized = " ".join(text.split())
        found = [term for term in terms if term.lower() in normalized.lower()]
        if found:
            matches.append((page_number, found, normalized))

    pages_to_render = sorted({0, *(page_number for page_number, _, _ in matches[:12])})
    for page_number in pages_to_render:
        page = doc[page_number]
        pixmap = page.get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5), alpha=False)
        image_path = output_dir / f"{path.stem}_p{page_number + 1}.png"
        pixmap.save(image_path)

    print(f"rendered={', '.join(str(page + 1) for page in pages_to_render)}")
    print(f"matching_pages={len(matches)}")
    for page_number, found, excerpt in matches[:20]:
        print(f"\npage={page_number + 1} terms={found}\n{excerpt[:900]}")
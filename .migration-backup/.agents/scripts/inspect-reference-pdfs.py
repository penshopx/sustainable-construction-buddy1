from pathlib import Path
import re
import fitz


SOURCE_DIR = Path("attached_assets")
OUTPUT_DIR = Path(".agents/outputs/reference-pdfs")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:90]


for source in sorted(SOURCE_DIR.glob("*.pdf")):
    if "KEP_DIRJEN_BK_281" not in source.name and not re.match(r"[0-3]\._", source.name):
        continue

    document = fitz.open(source)
    slug = slugify(source.stem)
    text_path = OUTPUT_DIR / f"{slug}.txt"
    with text_path.open("w", encoding="utf-8") as text_file:
        text_file.write(f"FILE: {source.name}\n")
        text_file.write(f"PAGES: {document.page_count}\n")
        text_file.write(f"METADATA: {document.metadata}\n\n")
        for page_number, page in enumerate(document, start=1):
            text_file.write(f"\n--- PAGE {page_number} ---\n")
            text_file.write(page.get_text("text"))

    # Render representative pages so slide layouts and visual tables are inspected.
    representative_pages = sorted({0, document.page_count // 2, document.page_count - 1})
    for page_index in representative_pages:
        page = document.load_page(page_index)
        pixmap = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
        pixmap.save(OUTPUT_DIR / f"{slug}-page-{page_index + 1:03d}.png")

    print(f"{source.name}\tpages={document.page_count}\ttext={text_path}")
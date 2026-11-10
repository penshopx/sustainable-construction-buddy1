from pathlib import Path

import pymupdf


PDF_PATH = Path("attached_assets/Platform_Digital_PUB_ASPEKINDO-1_1789018961656.pdf")
OUTPUT_DIR = Path(".agents/outputs/latest-pub-presentation")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    document = pymupdf.open(PDF_PATH)
    thumbnails = []

    for index, page in enumerate(document):
        pixmap = page.get_pixmap(matrix=pymupdf.Matrix(1.4, 1.4), alpha=False)
        page_path = OUTPUT_DIR / f"page-{index + 1:02d}.png"
        pixmap.save(page_path)

        thumbnail = page.get_pixmap(matrix=pymupdf.Matrix(0.32, 0.32), alpha=False)
        thumbnails.append(thumbnail)

    columns = 5
    padding = 12
    thumb_width = max(item.width for item in thumbnails)
    thumb_height = max(item.height for item in thumbnails)
    rows = (len(thumbnails) + columns - 1) // columns
    sheet = pymupdf.Pixmap(
        pymupdf.csRGB,
        pymupdf.IRect(
            0,
            0,
            columns * thumb_width + (columns + 1) * padding,
            rows * thumb_height + (rows + 1) * padding,
        ),
        False,
    )
    sheet.clear_with(245)

    for index, thumbnail in enumerate(thumbnails):
        row, column = divmod(index, columns)
        x = padding + column * (thumb_width + padding)
        y = padding + row * (thumb_height + padding)
        sheet.copy(thumbnail, pymupdf.IRect(x, y, x + thumbnail.width, y + thumbnail.height))

    sheet.save(OUTPUT_DIR / "contact-sheet.png")
    print(f"Rendered {document.page_count} pages to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
from pathlib import Path
import sys
import pymupdf
from PIL import Image, ImageDraw

output_dir = Path(".agents/outputs/pdf-contact-sheets")
output_dir.mkdir(parents=True, exist_ok=True)

for raw_path in sys.argv[1:]:
    path = Path(raw_path)
    doc = pymupdf.open(path)
    thumbnails = []
    for page_number, page in enumerate(doc):
        pixmap = page.get_pixmap(matrix=pymupdf.Matrix(0.45, 0.45), alpha=False)
        image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
        canvas = Image.new("RGB", (image.width, image.height + 28), "white")
        canvas.paste(image, (0, 28))
        ImageDraw.Draw(canvas).text((8, 7), f"Page {page_number + 1}", fill="black")
        thumbnails.append(canvas)

    columns = 3
    rows = (len(thumbnails) + columns - 1) // columns
    cell_width = max(image.width for image in thumbnails)
    cell_height = max(image.height for image in thumbnails)
    sheet = Image.new("RGB", (columns * cell_width, rows * cell_height), "#d9d9d9")
    for index, thumbnail in enumerate(thumbnails):
        x = (index % columns) * cell_width
        y = (index // columns) * cell_height
        sheet.paste(thumbnail, (x, y))

    destination = output_dir / f"{path.stem}_contact-sheet.png"
    sheet.save(destination)
    print(destination)
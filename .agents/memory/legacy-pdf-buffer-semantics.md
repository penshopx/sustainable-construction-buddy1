---
name: Buffer pada parser PDF lama
description: Perbedaan slice Buffer dan Uint8Array pada pdf-parse berbasis PDF.js lama.
---

Saat memakai pdf-parse/PDF.js lama, berikan salinan Uint8Array biasa, bukan
Buffer Node, meskipun deklarasi TypeScript lama hanya menyebut Buffer.

**Why:** PDF sintetis yang valid menurut pdfinfo ditolak dengan “bad XRef entry”
ketika input berupa Buffer, tetapi byte yang sama terbaca ketika diberikan
sebagai Uint8Array. Parser lama mengasumsikan perilaku slice salinan, bukan view.

**How to apply:** Pertahankan uji PDF image-only dan batas halaman saat mengganti
parser atau versi Node. Jangan menganggap kegagalan tersebut bukti file rusak.

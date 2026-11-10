import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";

test("pembaca Excel aktif memakai rilis SheetJS yang sudah memperbaiki prototype pollution dan ReDoS", () => {
  const [major, minor, patch] = XLSX.version.split(".").map(Number);
  assert.ok(major > 0 || minor > 20 || (minor === 20 && patch >= 2), `SheetJS tidak aman: ${XLSX.version}`);
});

test("template XLSX soal dan peserta tetap dapat diekspor lalu diimpor dengan data Indonesia", () => {
  for (const rows of [
    [{ pertanyaan: "Apa tujuan pengendalian risiko?", jawaban: "Mencegah kerugian", kategori: "Manajerial", bobot: 5 }],
    [{ nama: "Peserta Uji", perusahaan: "BUJK Uji", nilai: 85, email: "uji@example.invalid" }],
  ]) {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "Template");
    const bytes = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
    const parsed = XLSX.read(bytes, { type: "buffer" });
    assert.deepEqual(XLSX.utils.sheet_to_json(parsed.Sheets[parsed.SheetNames[0]]), rows);
  }
});

test("impor CSV lama tetap berfungsi setelah pembaruan pembaca Excel", () => {
  const book = XLSX.read("nama,nilai\nPeserta Uji,85", { type: "string" });
  assert.deepEqual(XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]]), [{ nama: "Peserta Uji", nilai: 85 }]);
});

"""Offline integrity checks; no model calls, auth, or hosted database access."""
import csv
import json
import re
import unittest
from pathlib import Path
from build_scheme_matrix import clean, scope_text, extract_subclass_scopes

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "generated-artifacts/scheme-matrix"
MATRIX = json.loads((ROOT / "artifacts/api-server/src/data/construction-scheme-matrix.json").read_text())
CORPUS = json.loads((ROOT / "artifacts/api-server/src/data/lpjk-knowledge.json").read_text())
DOCS = {doc["id"]: doc for doc in CORPUS["documents"]}
ROWS = {row["code"]: row for row in MATRIX["records"]}


class SchemeMatrixTests(unittest.TestCase):
    def test_complete_unique_cover_codes_not_copied_table_count(self):
        self.assertEqual(len(MATRIX["records"]), len(ROWS))
        self.assertEqual(len(ROWS), 77)
        self.assertEqual(MATRIX["counts"], dict(BG=9, BS=20, IN=13, KK=16, KP=2, PA=1, PB=8, PL=8))
        for scheme in MATRIX["schemes"]:
            doc = DOCS[scheme["id"]]
            prefix = next(r["classification"] for r in ROWS.values() if r["requirementsSourceId"] == doc["id"])
            declared = set(re.findall(r"\b" + prefix + r"\d{3}\b", " ".join(p["text"] for p in doc["pages"][:2])))
            self.assertEqual(declared, {r["code"] for r in ROWS.values() if r["classification"] == prefix})
            self.assertEqual(scheme["sha256"], doc["sha256"])
        for key, value in MATRIX["sourceHashes"].items():
            self.assertEqual(value, DOCS[key]["sha256"])

    def test_mapping_cells_and_physical_page_references_are_grounded(self):
        for row in ROWS.values():
            ref = row["mappingReference"]
            original = DOCS[ref["id"]]["pages"][ref["page"] - 1]["text"]
            self.assertIn(row["code"], original)
            self.assertIn(row["kbliCode"], original)
            self.assertEqual(row["kbliCode"], clean(ref["rawCells"][0]))
            self.assertEqual(row["schemeKbliTitle"], clean(ref["rawCells"][1]))
            self.assertEqual(len(ref["bbox"]), 4)
            self.assertIn("BUJK", row["qualificationText"])
        self.assertNotIn("K (", ROWS["PL001"]["qualificationText"],
                         "do not fill an absent small-business qualification from other rows")

    def test_both_scope_layers_retain_exact_quotes_and_correct_boundaries(self):
        for row in ROWS.values():
            for key, source in [("subclassificationScope", "KB19"), ("kbli2025", "KB44")]:
                scope = row[key]
                self.assertIsNotNone(scope)
                self.assertTrue(scope["text"].startswith("Kelompok"))
                self.assertNotIn("Istilah dan Definisi", scope["text"])
                self.assertNotIn("PERDAGANGAN BESAR DAN ECERAN", scope["text"])
                for ref in scope["references"]:
                    self.assertEqual(ref["id"], source)
                    self.assertIn(ref["excerpt"], DOCS[source]["pages"][ref["page"] - 1]["text"])
                self.assertIn(scope["text"], scope_text("\n".join(r["excerpt"] for r in scope["references"])))
        self.assertIn("pembongkaran", ROWS["BG001"]["subclassificationScope"]["text"])
        self.assertNotIn("pembongkaran", ROWS["BG001"]["kbli2025"]["text"])
        self.assertEqual(ROWS["KK008"]["subclassificationScope"]["title"], "Perkerasan Aspal")
        self.assertEqual(ROWS["PB011"]["subclassificationScope"]["text"],
                         "Kelompok ini mencakup pekerjaan pemulihan lahan kembali ke fungsi semula.")
        self.assertEqual([r["page"] for r in ROWS["KK008"]["kbli2025"]["references"]], [594])

    def test_shared_kbli_never_implies_shared_subclassification_scope(self):
        self.assertEqual(ROWS["KK008"]["kbliCode"], ROWS["PB011"]["kbliCode"])
        self.assertIn("PB011", ROWS["KK008"]["otherSubclassesWithSameKbli"])
        self.assertNotEqual(ROWS["KK008"]["subclassificationScope"]["text"], ROWS["PB011"]["subclassificationScope"]["text"])
        self.assertTrue(MATRIX["runtimeConnected"])
        self.assertEqual(MATRIX["status"], "draft_reference_matrix")

    def test_all_eleven_general_requirement_sections_cite_real_headings(self):
        for scheme in MATRIX["schemes"]:
            self.assertEqual(len(scheme["requirements"]), 11)
            for ref in scheme["requirements"]:
                self.assertEqual(ref["referenceType"], "section_start")
                self.assertIn(ref["excerpt"], DOCS[ref["id"]]["pages"][ref["page"] - 1]["text"])

    def test_copied_table_differences_are_visible_not_silently_applied(self):
        delta = MATRIX["comparisonWithCopiedTable"]
        self.assertEqual(delta["schemeOnly"], ["IN014"])
        self.assertEqual(delta["copiedTableOnly"], [])
        self.assertEqual(len(delta["differentKbli"]), 16)
        for code in delta["differentKbli"]:
            row = ROWS[code]
            self.assertNotEqual(row["kbliCode"], row["copiedTable"]["kbliCode"])
            self.assertTrue(any("berbeda" in note for note in row["reviewNotes"]))

    def test_balanced_parentheses_and_page_spanning_scope(self):
        doc = {"id": "fixture", "pages": [
            {"text": "KK001 (Konstruksi (Contoh))\nKelompok\nini mencakup awal"},
            {"text": "- 2 -\nkelanjutan.\n2. Istilah dan Definisi\nBUKAN RUANG LINGKUP"},
        ]}
        result = extract_subclass_scopes(doc)["KK001"]
        self.assertEqual(result["title"], "Konstruksi (Contoh)")
        self.assertEqual(result["text"], "Kelompok ini mencakup awal kelanjutan.")
        self.assertEqual([ref["page"] for ref in result["references"]], [1, 2])

    def test_review_files_have_all_records_and_no_external_dependencies(self):
        with (OUT / "matriks-skema-konstruksi.csv").open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.reader(handle))
        self.assertEqual(len(rows), 78)
        self.assertTrue(all(len(row) == 16 for row in rows))
        self.assertEqual({row[1] for row in rows[1:]}, set(ROWS))
        self.assertFalse(any(cell.startswith(("=", "+", "-", "@")) for row in rows[1:] for cell in row))
        html = (OUT / "matriks-skema-konstruksi.html").read_text()
        self.assertEqual(html.count("<tr data-group="), 77)
        self.assertNotRegex(html, r'(?:src|href)=["\']https?://')
        self.assertIn("bukan konsolidasi hukum otomatis", html)
        self.assertIn("bukan daftar lengkap aturan per kode", html)


if __name__ == "__main__":
    unittest.main()

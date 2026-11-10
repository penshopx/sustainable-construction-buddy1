"""Build a source-traceable draft offline; no hosted mutations or model requests."""
from pathlib import Path
from bisect import bisect_right
from collections import Counter, defaultdict
import csv
import hashlib
import json
import re
import pymupdf as fitz
from scheme_matrix_report import render_report

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "generated-artifacts/scheme-matrix"
DATA = ROOT / "artifacts/api-server/src/data/construction-scheme-matrix.json"


def clean(value):
    return re.sub(r"\s+", " ", value or "").strip()


def decorative(line):
    line = clean(line)
    return not line or bool(re.fullmatch(
        r"https?://(?:www\.)?bps\.go\.id/?|-\s*\d+\s*-|\d{1,4}|"
        r"Klasifikasi Baku Lapangan Usaha Indonesia \(KBLI\) 2025|F\s+KONSTRUKSI", line))


def scope_text(value):
    return clean("\n".join(line for line in value.splitlines() if not decorative(line)))


def joined_pages(doc):
    text, starts = "", []
    for page in doc["pages"]:
        starts.append(len(text))
        text += page["text"] + "\n"
    return text, starts


def references(doc, text, starts, begin, end):
    result = []
    for index in range(bisect_right(starts, begin) - 1, len(starts)):
        left, right = max(begin, starts[index]), min(end, starts[index + 1] if index + 1 < len(starts) else len(text))
        if left >= right:
            break
        original = text[left:right]
        lines = original.splitlines(keepends=True)
        while lines and decorative(lines[0]):
            lines.pop(0)
        while lines and decorative(lines[-1]):
            lines.pop()
        excerpt = "".join(lines).rstrip("\n")
        if excerpt.strip():
            result.append({"id": doc["id"], "page": index + 1, "excerpt": excerpt})
    return result


def extract_subclass_scopes(doc):
    """Balanced names, including scopes continuing onto the next physical page."""
    text, starts = joined_pages(doc)
    headings = []
    for match in re.finditer(r"\b([A-Z]{2}\d{3})\s*\(", text):
        left, cursor, depth = match.end(), match.end(), 1
        while cursor < min(len(text), left + 400) and depth:
            depth += (text[cursor] == "(") - (text[cursor] == ")")
            cursor += 1
        if depth:
            continue
        after = text[cursor:cursor + 220]
        body = re.search(r"Kelompok\s+ini", after)
        if body and not re.search(r"\b[A-Z]{2}\d{3}\b", after[:body.start()]):
            headings.append((match.start(), cursor + body.start(), match[1], clean(text[left:cursor - 1])))
    result = {}
    for index, (begin, body, code, title) in enumerate(headings):
        end = headings[index + 1][0] if index + 1 < len(headings) else len(text)
        boundary = re.search(r"\b2\.?\s+Istilah\s+dan\s+Definisi\b", text[body:end], re.I)
        if boundary:
            end = body + boundary.start()
        trailing = re.search(r"\s+[a-z]\.\s*$", text[body:end])
        if trailing:
            end = body + trailing.start()
        refs = references(doc, text, starts, body, end)
        if code in result:
            raise ValueError(f"Ambiguous duplicate normative scope: {code}")
        result[code] = {"title": title, "text": scope_text(text[body:end]), "references": refs}
    return result


def extract_kbli_scopes(doc, wanted_codes):
    text, starts = joined_pages(doc)
    headings = []
    # Stop at the next hierarchy heading, not just the next five-digit code.
    for match in re.finditer(r"(?m)^([A-V]|\d{2,5})[ \t]*\n", text):
        tail = text[match.end():match.end() + 450]
        lines, used = [], 0
        for line in tail.splitlines(keepends=True):
            if not line.strip():
                used += len(line)
                continue
            if not line.strip().isupper():
                break
            lines.append(line.strip())
            used += len(line)
        if lines:
            headings.append((match.start(), match.end() + used, match[1], clean(" ".join(lines))))
    result = {}
    for index, (begin, body, code, title) in enumerate(headings):
        end = headings[index + 1][0] if index + 1 < len(headings) else len(text)
        if code not in wanted_codes or not re.match(r"\s*Kelompok\s+ini", text[body:end]):
            continue
        if code in result:
            raise ValueError(f"Ambiguous duplicate KBLI definition: {code}")
        result[code] = {"title": title, "text": scope_text(text[body:end]),
                        "references": references(doc, text, starts, begin, end)}
    return result


REQUIREMENTS = {
    "3.1": "Kriteria Penjualan Tahunan",
    "3.2": "Kriteria Kemampuan Keuangan",
    "3.3": "Kriteria Ketersediaan Tenaga Kerja",
    "3.4": "Kriteria Kemampuan Penyediaan Peralatan",
    "3.5": "Kriteria Penerapan Sistem Manajemen Anti Penyuapan",
    "5.1": "Permohonan Sertifikasi",
    "5.1.1": "Persyaratan Data Administrasi",
    "5.1.2": "Persyaratan Data Penjualan",
    "5.1.3": "Persyaratan Data Kemampuan Keuangan",
    "5.1.4": "Persyaratan Data Ketersediaan Tenaga Kerja",
    "5.1.5": "Persyaratan Data Kemampuan Penyediaan Peralatan",
}


def requirement_starts(doc):
    refs = []
    for clause, label in REQUIREMENTS.items():
        pattern = re.compile(r"(?m)^\s*" + re.escape(clause) + r"\.?\s*" + r"\s+".join(map(re.escape, label.split())), re.I)
        for page in doc["pages"][20:120]:
            match = pattern.search(page["text"])
            if match:
                refs.append({"clause": clause, "label": label, "id": doc["id"],
                             "page": page["page"], "excerpt": match[0].strip(),
                             "referenceType": "section_start"})
                break
    return refs


def extract_mapping(doc):
    prefix = re.search(r"Sertifikasi_([A-Z]+)_", doc["fileName"])[1]
    declared = set(re.findall(r"\b" + prefix + r"\d{3}\b", " ".join(p["text"] for p in doc["pages"][:2])))
    found = {}
    path = ROOT / "attached_assets" / doc["fileName"]
    if hashlib.sha256(path.read_bytes()).hexdigest() != doc["sha256"]:
        raise ValueError(f"Source hash changed: {doc['id']}")
    with fitz.open(path) as pdf:
        for number in range(21, 25):
            for table in pdf[number - 1].find_tables().tables:
                for raw in table.extract():
                    cells = [clean(cell) for cell in raw]
                    codes = re.findall(r"\b" + prefix + r"\d{3}\b", " ".join(cells))
                    if len(codes) != 1 or not re.fullmatch(r"\d{5}", cells[0]):
                        continue
                    code = codes[0]
                    if code in found:
                        raise ValueError(f"Duplicate mapping row: {code}")
                    sifat = re.search(r"\b(Umum|Spesialis)\b", " ".join(cells))
                    # Some PDFs merge SIFAT into column 3 or add an empty column.
                    qualification = next((cell for cell in reversed(cells) if "BUJK" in cell), "")
                    if not sifat or not qualification:
                        raise ValueError(f"Incomplete source table: {code}")
                    found[code] = {
                        "code": code, "classification": prefix, "kbliCode": cells[0],
                        "schemeKbliTitle": cells[1], "businessNature": sifat[1],
                        "qualificationText": qualification, "mappingReference": {
                            "id": doc["id"], "page": number, "rawCells": raw,
                            "bbox": list(table.bbox),
                        },
                    }
        if set(found) != declared:
            raise ValueError(f"Cover/table mismatch {prefix}: missing={declared-set(found)}, extra={set(found)-declared}")
        if prefix in ("BG", "BS", "PB"):
            number = 23 if prefix == "BS" else (22 if prefix == "PB" else 21)
            pdf[number - 1].get_pixmap(matrix=fitz.Matrix(1, 1), alpha=False).save(OUT / f"{prefix}-table-{number}.png")
    return found


def citation(ref):
    return f"[{ref['id']}, halaman PDF {ref['page']}]"


def build():
    OUT.mkdir(parents=True, exist_ok=True)
    corpus = json.loads((ROOT / "artifacts/api-server/src/data/lpjk-knowledge.json").read_text())
    docs = {doc["id"]: doc for doc in corpus["documents"]}
    mappings = [(doc, extract_mapping(doc)) for doc in corpus["documents"][8:16]]
    legal_scopes = extract_subclass_scopes(docs["KB19"])
    kbli_scopes = extract_kbli_scopes(docs["KB44"], {
        row["kbliCode"] for _, rows in mappings for row in rows.values()
    })
    copied = {}
    for line in docs["KB45"]["lines"]:
        match = re.match(r"^([A-Z]{2}\d{3})\s*(\d{5})", line["text"])
        if match:
            copied[match[1]] = {"kbliCode": match[2], "line": line["line"]}
    records, schemes = [], []
    for doc, rows in mappings:
        refs = requirement_starts(doc)
        schemes.append({"id": doc["id"], "title": doc["title"], "sha256": doc["sha256"],
                        "note": doc["note"], "requirements": refs})
        for code, row in rows.items():
            legal, kbli = legal_scopes.get(code), kbli_scopes.get(row["kbliCode"])
            issues = []
            if not legal:
                issues.append("Ruang lingkup khusus subklasifikasi belum terpetakan dari KB19; jangan menggantinya dengan seluruh cakupan KBLI.")
            if not kbli:
                issues.append("Definisi kode belum terpetakan dari modul KBLI 2025.")
            if len(refs) != len(REQUIREMENTS):
                issues.append("Sebagian awal bagian persyaratan belum terpetakan; periksa dokumen skema.")
            if code not in copied:
                issues.append("Kode terdapat dalam skema, tetapi tidak terdapat dalam tabel salinan KB45.")
            elif row["kbliCode"] != copied[code]["kbliCode"]:
                issues.append("Kode KBLI skema berbeda dari tabel salinan KB45; jangan menggabungkannya otomatis.")
            row.update(subclassificationScope=legal, kbli2025=kbli, requirementsSourceId=doc["id"],
                       copiedTable=copied.get(code), reviewNotes=issues,
                       status="draft_reference_matrix")
            records.append(row)
    by_kbli = defaultdict(list)
    for row in records:
        by_kbli[row["kbliCode"]].append(row["code"])
    for row in records:
        row["otherSubclassesWithSameKbli"] = sorted(set(by_kbli[row["kbliCode"]]) - {row["code"]})
    records.sort(key=lambda row: row["code"])
    primary = {row["code"] for row in records}
    result = {
        "schemaVersion": 1, "status": "draft_reference_matrix", "runtimeConnected": True,
        "scope": "existing-uploaded-references-only", "scopeSource": "KB19",
        "kbliSource": "KB44", "schemes": schemes,
        "sourceHashes": {key: docs[key]["sha256"] for key in ["KB19", "KB44", "KB45"]},
        "counts": dict(sorted(Counter(row["classification"] for row in records).items())),
        "comparisonWithCopiedTable": {
            "schemeOnly": sorted(primary - copied.keys()),
            "copiedTableOnly": sorted(copied.keys() - primary),
            "differentKbli": [row["code"] for row in records if row["copiedTable"] and row["kbliCode"] != row["copiedTable"]["kbliCode"]],
        },
        "boundaries": [
            "Draf ekstraksi rujukan, bukan keputusan kelayakan atau penerbitan SBU.",
            "Ruang lingkup subklasifikasi KB19 dan uraian KBLI 2025 disajikan terpisah; bukan konsolidasi hukum otomatis.",
            "Satu KBLI dapat dipakai beberapa subklasifikasi; seluruh uraian KBLI bukan otomatis kewenangan setiap subklasifikasi.",
            "Rujukan persyaratan menunjuk awal bagian umum skema, bukan aturan kelulusan atau normalisasi semua ambang nilai per kode.",
            "Tabel salinan KB45 hanya pembanding; tidak menimpa dokumen skema.",
            "Referensi teknis tambahan, dokumen pribadi anggota, dan panggilan AI tidak digunakan.",
        ],
        "records": records,
    }
    DATA.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    catalog = {"status": "draft_reference_matrix", "records": [{
        "code": row["code"], "classification": row["classification"],
        "title": row["subclassificationScope"]["title"] if row["subclassificationScope"] else row["schemeKbliTitle"],
        "kbliCode": row["kbliCode"], "reviewNotes": row["reviewNotes"],
        "references": [{"id": ref["id"], "page": ref["page"]} for ref in [
            row["mappingReference"],
            *(row["subclassificationScope"]["references"] if row["subclassificationScope"] else []),
            *(row["kbli2025"]["references"] if row["kbli2025"] else []),
        ]],
    } for row in records]}
    (ROOT / "artifacts/pub-aspekindo/src/data/construction-scheme-catalog.json").write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")
    with (OUT / "matriks-skema-konstruksi.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["Klasifikasi", "Subklasifikasi", "Nama subklasifikasi (KB19)", "KBLI skema", "Judul KBLI skema",
                         "Sifat usaha", "Kualifikasi (teks sumber)", "Rujukan pemetaan", "Ruang lingkup subklasifikasi (KB19)",
                         "Rujukan ruang lingkup", "Uraian KBLI 2025 (terpisah)", "Rujukan KBLI 2025",
                         "Rujukan awal bagian persyaratan umum", "Subklasifikasi lain dengan KBLI sama", "Catatan peninjauan", "Status"])
        for row in records:
            legal, kbli = row["subclassificationScope"], row["kbli2025"]
            scheme = next(s for s in schemes if s["id"] == row["requirementsSourceId"])
            cells = [row["classification"], row["code"], legal["title"] if legal else "", row["kbliCode"],
                     row["schemeKbliTitle"], row["businessNature"], row["qualificationText"], citation(row["mappingReference"]),
                     legal["text"] if legal else "", " ".join(map(citation, legal["references"])) if legal else "",
                     kbli["text"] if kbli else "", " ".join(map(citation, kbli["references"])) if kbli else "",
                     "; ".join(f"{r['clause']} {r['label']} {citation(r)}" for r in scheme["requirements"]),
                     ", ".join(row["otherSubclassesWithSameKbli"]), "; ".join(row["reviewNotes"]), row["status"]]
            writer.writerow(["'" + cell if cell.startswith(("=", "+", "-", "@")) else cell for cell in cells])
    (OUT / "matriks-skema-konstruksi.html").write_text(render_report(result), encoding="utf-8")
    print(json.dumps({"records": len(records), "counts": result["counts"],
                      "missingLegalScopes": [r["code"] for r in records if not r["subclassificationScope"]],
                      "missingKbli": [r["code"] for r in records if not r["kbli2025"]],
                      "requirementsCounts": {s["id"]: len(s["requirements"]) for s in schemes},
                      "comparison": result["comparisonWithCopiedTable"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    build()

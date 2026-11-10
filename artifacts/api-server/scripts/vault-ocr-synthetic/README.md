# Synthetic OCR benchmark

This runner never reads member documents, storage, database, or accounts. It
generates fixed Indonesian test documents locally. Do not add real documents.

## Offline preparation and verification (no paid requests)

```sh
node artifacts/api-server/scripts/check-vault-ocr-synthetic.mjs
cd artifacts/api-server
node --test tests/vault-ocr-synthetic.test.mjs tests/vault-ocr-pdf-limits.test.mjs tests/vault-ocr.test.mjs
```

Requires ImageMagick `convert` with DejaVu Sans, and existing API dependencies.
The default command only generates fixtures; `accuracyProven` stays false.
Unit tests check scoring and failure handling, **not OCR accuracy**.
The PDF smoke test uses the live runner's shared worker build/lifecycle from
`worker.mjs`, with real rasterization and absolute external-module resolution;
only inference is stubbed. It exercises both generated PDF ranges offline.
No server restart or application build is needed: live mode bundles the current
extractor and citation-window implementation into the ignored output directory.

## Paid live run

First obtain explicit user approval for paid synthetic testing AND confirmation
that provider credits/limits can accommodate up to seven sequential requests
with the application's 12,000-token output limit. A prior HTTP 402 means blocked,
not an accuracy failure or permission to switch providers. Do not automatically
retry, top up credits, or reduce production limits to bypass it.

Only after those conditions are satisfied:

```sh
RS_OCR_SYNTHETIC_LIVE=1 RS_OCR_PAID_APPROVED=1 RS_OCR_CREDIT_CONFIRMED=1 \
  node artifacts/api-server/scripts/check-vault-ocr-synthetic.mjs
```

The existing secret is consumed by the production worker without printing it.
Provider/model/privacy restrictions remain those of `vault-ocr-provider.ts`.
The runner stops on the first provider/worker error; it does not retry or fall
back. At most seven requests are made: clean certificate PNG, Indonesian PNG,
perspective-warped/rotated JPEG, 560×360 low-quality JPEG, gridded table PNG,
three-page raster-only PDF, and original PDF pages 2–3. Processing all fixtures
continues after an accuracy mismatch, so every successfully returned case can
be measured.

## Independent oracle and scoring

`reference.json` is a separately authored expected transcription/evidence oracle,
not derived from provider output, PDF text extraction, scoring, or rendering.
`fixtures.mjs` contains the independent drawing recipe and never imports the
oracle. Both must be reviewed together if the visible test content changes.
It is intentionally small and hand-auditable, not a representative accuracy
estimate for all member uploads.

Every page must have character error rate ≤5%, word error rate ≤10%, and every
critical evidence phrase exactly present after normalization. Numbers,
negation, dates, table row relationships, and end markers are mandatory;
otherwise a nearly complete but truncated response could pass an average.
Normalization ignores case, punctuation, whitespace and Markdown table separators,
not letters/digits. CER/WER are Levenshtein edit distances divided by reference
length and can exceed 1. Table transposition or missing evidence fails even when
all numbers exist somewhere else on the page.

Quotes are generated using the real `vaultSourceWindows`, not copied from the
oracle. Every expected evidence phrase must occur in a quote bounded to that
page, with the correct original page label and fixture ID. Missing/reordered page
maps fail. These checks measure extracted citation evidence, not generated chat
answers or legal conclusions.

Offline protocol tests inject `finish_reason: length` with otherwise complete
evidence and check explicit `OCR_OUTPUT_LIMIT` rejection by the real parser,
plus oversized output and 402 rejection. Those injected responses prove only
the rejection contract, never live accuracy. Live mode also uses that same
production parser, so a genuinely truncated provider response fails the run.

## Results

Files are under ignored `generated-artifacts/vault-ocr-synthetic/`. `result.json`
records mode, status, each page's CER/WER, missing evidence and missing quotes.
Live observed text, offsets and actual citation windows are separate JSON files.
An old success report is invalidated before each run. Failed/blocked runs never
claim accuracy. Exit code is nonzero on any mismatch or execution failure.
Fixture-only runs report `not-run`; these must never be reported as live passes.

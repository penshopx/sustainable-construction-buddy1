export type OcrPageRange = { start: number; end: number };

export function validOcrRange(range: OcrPageRange | undefined): range is OcrPageRange {
  return !!range && Number.isSafeInteger(range.start) && Number.isSafeInteger(range.end)
    && range.start >= 1 && range.end >= range.start && range.end <= 100_000
    && range.end - range.start < 30;
}

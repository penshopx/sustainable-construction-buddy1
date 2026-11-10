type Sheet = Record<string, unknown>;

interface Workbook {
  SheetNames: string[];
  Sheets: Record<string, Sheet | undefined>;
}

export const utils = {
  book_new: (): Workbook => ({ SheetNames: [], Sheets: {} }),
  book_append_sheet: (workbook: Workbook, sheet: Sheet, name: string): void => {
    workbook.SheetNames.push(name);
    workbook.Sheets[name] = sheet;
  },
  json_to_sheet: (_rows: readonly Record<string, unknown>[]): Sheet => ({}),
  aoa_to_sheet: (_rows: readonly (readonly unknown[])[]): Sheet => ({}),
  sheet_to_json: <T extends Record<string, unknown>>(_sheet: Sheet | undefined, _options?: unknown): T[] => [],
  decode_range: (_range: string) => ({ s: { r: 0, c: 0 }, e: { r: 0, c: 0 } }),
};
export const writeFile = (_workbook: Workbook, _filename: string): void => {};
export const write = (_workbook: Workbook, _options?: unknown): Uint8Array => new Uint8Array();
export const read = (_data: unknown, _options?: unknown): Workbook => ({ SheetNames: [], Sheets: {} });
export const readFile = (_filename: string, _options?: unknown): Workbook => ({ SheetNames: [], Sheets: {} });
export const SSF = {};

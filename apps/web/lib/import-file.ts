import { IMPORT_COLUMNS, normaliseHeader, type ImportInput } from "@catafy/types";

type Cell = string | number | boolean | null;
export type ImportRows = ImportInput["rows"];

export interface ParsedFile {
  rows: ImportRows;
  /** Headers that aren't import columns; ignored. */
  ignored: string[];
  /** Required columns missing from the header row. */
  missing: string[];
}

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
const KNOWN = new Set<string>(IMPORT_COLUMNS.map((c) => c.key));
const REQUIRED = IMPORT_COLUMNS.filter((c) => c.required).map((c) => c.key);

/** exceljs cell values can be rich text, formulas, hyperlinks or dates. */
function plain(value: unknown): Cell {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as {
      result?: unknown;
      text?: unknown;
      richText?: { text: string }[];
    };
    if ("result" in v) return plain(v.result);
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return plain(v.text);
  }
  return String(value);
}

function toRows(headers: string[], records: { row: number; values: unknown[] }[]): ParsedFile {
  const keys = headers.map((h) => normaliseHeader(h));
  const rows: ImportRows = [];
  for (const { row, values } of records) {
    const cells: Record<string, Cell> = {};
    keys.forEach((key, i) => {
      if (KNOWN.has(key)) cells[key] = plain(values[i]);
    });
    const blank = Object.values(cells).every((v) => v === null || String(v).trim() === "");
    if (!blank) rows.push({ row, cells });
  }
  return {
    rows,
    ignored: headers.filter((h, i) => h.trim() && !KNOWN.has(keys[i]!)),
    missing: REQUIRED.filter((k) => !keys.includes(k)),
  };
}

async function parseXlsx(file: File): Promise<ParsedFile> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) return { rows: [], ignored: [], missing: REQUIRED };

  const width = sheet.columnCount;
  const header = sheet.getRow(1);
  const headers = Array.from({ length: width }, (_, i) =>
    String(plain(header.getCell(i + 1).value) ?? ""),
  );
  const records: { row: number; values: unknown[] }[] = [];
  sheet.eachRow((r, rowNumber) => {
    if (rowNumber === 1) return;
    records.push({
      row: rowNumber,
      values: Array.from({ length: width }, (_, i) => r.getCell(i + 1).value),
    });
  });
  return toRows(headers, records);
}

async function parseCsv(file: File): Promise<ParsedFile> {
  const { default: Papa } = await import("papaparse");
  // Keep empty lines so row numbers match what the owner sees in the spreadsheet.
  const { data } = Papa.parse<string[]>(await file.text(), { skipEmptyLines: false });
  const [headers = [], ...lines] = data;
  return toRows(
    headers,
    lines.map((values, i) => ({ row: i + 2, values })),
  );
}

export function parseImportFile(file: File): Promise<ParsedFile> {
  return /\.csv$/i.test(file.name) ? parseCsv(file) : parseXlsx(file);
}

/** Builds the .xlsx template in the browser: a Products sheet with examples, plus instructions. */
export async function downloadTemplate(): Promise<void> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet("Products", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = IMPORT_COLUMNS.map((c) => ({
    header: c.required ? `${c.key}*` : c.key,
    key: c.key,
    width: Math.max(12, c.key.length + 4),
  }));
  sheet.getRow(1).font = { bold: true };
  const example = Object.fromEntries(IMPORT_COLUMNS.map((c) => [c.key, c.example]));
  sheet.addRow(example);
  // A second size of the same product: product columns can stay blank.
  sheet.addRow({ title: example.title, size: "L", colour: "White", sku: "CK-L-WH", stock: 6 });

  const help = workbook.addWorksheet("Instructions");
  help.columns = [
    { header: "Column", key: "column", width: 14 },
    { header: "Required", key: "required", width: 10 },
    { header: "How to fill it", key: "help", width: 70 },
  ];
  help.getRow(1).font = { bold: true };
  for (const c of IMPORT_COLUMNS) {
    help.addRow({ column: c.key, required: c.required ? "yes" : "", help: c.help });
  }
  help.addRow({});
  help.addRow({
    help: "One row per size/colour. Rows with the same title (or slug) become one product.",
  });
  help.addRow({ help: "Add photos afterwards from each product's page." });

  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "product-import-template.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

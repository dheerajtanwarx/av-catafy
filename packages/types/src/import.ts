import { z } from "zod";
import { rupeesToPaise } from "./catalog.js";
import { slugSchema } from "./common.js";

/**
 * Bulk import: one spreadsheet row per variant. Rows with the same slug (or, without a slug, the
 * same title) become one product; product columns only need filling on its first row.
 * This list drives the downloadable template, the parser and the validator.
 */
export const IMPORT_COLUMNS = [
  { key: "title", required: true, example: "Chikankari Kurti", help: "Product name." },
  {
    key: "slug",
    required: false,
    example: "",
    help: "Optional URL name. Generated from the title when blank.",
  },
  {
    key: "category",
    required: false,
    example: "Kurtis",
    help: "Category name. New names are created.",
  },
  { key: "description", required: false, example: "Hand-embroidered cotton kurti.", help: "" },
  { key: "price", required: true, example: 1299, help: "Selling price in rupees, e.g. 1299." },
  { key: "mrp", required: false, example: 1799, help: "Optional MRP in rupees (≥ price)." },
  { key: "fabric", required: false, example: "Cotton", help: "" },
  { key: "care", required: false, example: "Hand wash cold", help: "" },
  { key: "tags", required: false, example: "cotton, summer", help: "Comma-separated." },
  { key: "moq", required: false, example: 1, help: "Minimum order quantity. Default 1." },
  {
    key: "pack_size",
    required: false,
    example: "",
    help: "Pieces per set, for set/pack ordering.",
  },
  { key: "featured", required: false, example: "no", help: "yes / no. Default no." },
  { key: "active", required: false, example: "yes", help: "yes / no. Default yes." },
  { key: "size", required: false, example: "M", help: 'Variant size. Default "Free size".' },
  { key: "colour", required: false, example: "White", help: 'Variant colour. Default "Default".' },
  { key: "sku", required: false, example: "CK-M-WH", help: "Optional, unique." },
  { key: "stock", required: true, example: 10, help: "Pieces (or sets) in stock." },
] as const;
export type ImportColumn = (typeof IMPORT_COLUMNS)[number]["key"];

export const IMPORT_MAX_ROWS = 2000;

/** "Pack Size", "pack-size" and "PACK_SIZE" all mean pack_size. */
export function normaliseHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/^color$/, "colour");
}

// ---------- Cell coercion: spreadsheets give strings, numbers, booleans or nothing ----------

const cell = z.union([z.string(), z.number(), z.boolean(), z.null()]).optional();

const text = (max: number) =>
  cell
    .transform((v) => (v === null || v === undefined ? "" : String(v).trim()))
    .pipe(z.string().max(max));

const blankToUndefined = (v: unknown) =>
  v === null || v === undefined || (typeof v === "string" && v.trim() === "") ? undefined : v;

const number = (schema: z.ZodNumber) =>
  z.preprocess((v) => {
    const b = blankToUndefined(v);
    if (typeof b === "string") return Number(b.replace(/[₹,\s]/g, ""));
    return b;
  }, schema.optional());

const rupees = number(z.number({ invalid_type_error: "Enter a number" }).min(0))
  .refine((v) => v === undefined || Number.isFinite(v), "Enter a number")
  .refine(
    (v) => v === undefined || Math.abs(v * 100 - Math.round(v * 100)) < 1e-6,
    "At most 2 decimal places",
  )
  .transform((v) => (v === undefined ? undefined : rupeesToPaise(v)));

const wholeNumber = (min: number) =>
  number(
    z.number({ invalid_type_error: "Enter a whole number" }).int("Enter a whole number").min(min),
  );

const yesNo = z.preprocess(
  (v) => {
    const b = blankToUndefined(v);
    if (typeof b === "boolean" || b === undefined) return b;
    const s = String(b).trim().toLowerCase();
    if (["yes", "y", "true", "1"].includes(s)) return true;
    if (["no", "n", "false", "0"].includes(s)) return false;
    return s; // fails below with a clear message
  },
  z.boolean({ invalid_type_error: "Use yes or no" }).optional(),
);

/** One parsed spreadsheet row. Product fields are optional here: they may live on another row. */
export const importRowSchema = z.object({
  title: text(160),
  slug: text(120).pipe(slugSchema.or(z.literal(""))),
  category: text(80),
  description: text(5000),
  price: rupees,
  mrp: rupees,
  fabric: text(120),
  care: text(500),
  tags: text(1000),
  moq: wholeNumber(1),
  pack_size: wholeNumber(1),
  featured: yesNo,
  active: yesNo,
  size: text(40),
  colour: text(40),
  sku: text(64),
  stock: wholeNumber(0),
});
export type ImportRowParsed = z.output<typeof importRowSchema>;

export const importInputSchema = z.object({
  rows: z
    .array(
      z.object({
        /** Spreadsheet row number, for error messages (the header is row 1). */
        row: z.number().int().min(2),
        cells: z.record(z.string().max(40), cell),
      }),
    )
    .min(1, "The file has no product rows")
    .max(IMPORT_MAX_ROWS, `At most ${IMPORT_MAX_ROWS} rows per import`),
  /** false: validate and preview only. true: validate again and create. */
  commit: z.boolean().default(false),
});
export type ImportInput = z.input<typeof importInputSchema>;

export interface ImportIssue {
  row: number;
  column: ImportColumn | null;
  message: string;
}

export type ImportProductStatus = "ready" | "invalid" | "created" | "failed";

export interface ImportProductResult {
  title: string;
  slug: string;
  category: string | null;
  price: number | null;
  rows: number[];
  variantCount: number;
  totalStock: number;
  status: ImportProductStatus;
  issues: ImportIssue[];
}

export interface ImportReport {
  committed: boolean;
  products: ImportProductResult[];
  /** Category names not in the store yet: created on commit (and listed in the commit report). */
  newCategories: string[];
  summary: {
    rows: number;
    products: number;
    ready: number;
    invalid: number;
    created: number;
    failed: number;
  };
}

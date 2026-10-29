import {
  importRowSchema,
  productInputSchema,
  toSlug,
  type ImportColumn,
  type ImportIssue,
  type ImportProductResult,
  type ImportReport,
  type ImportRowParsed,
  type ProductInputParsed,
} from "@catafy/types";
import { mongo, type Types } from "mongoose";
import { uniqueSlug } from "../lib/slug.js";
import { Category, Product } from "../models/index.js";

interface ParsedRow {
  row: number;
  data: ImportRowParsed;
}

interface Group {
  key: string;
  /** As typed in the file, even when its rows failed to parse. */
  title: string;
  /** Every row of this product, parsed or not. */
  rowNumbers: number[];
  rows: ParsedRow[];
  issues: ImportIssue[];
  slug: string;
  input?: Omit<ProductInputParsed, "categoryId">;
  categoryName: string | null;
}

/** Product-level columns: filled on the product's first row, blank or identical on the rest. */
const PRODUCT_COLUMNS = [
  "title",
  "category",
  "description",
  "price",
  "mrp",
  "fabric",
  "care",
  "tags",
  "moq",
  "pack_size",
  "featured",
  "active",
] as const satisfies readonly ImportColumn[];

const isBlank = (v: unknown) => v === undefined || v === "";

function issue(row: number, column: ImportColumn | null, message: string): ImportIssue {
  return { row, column, message };
}

/** Maps a productInputSchema issue path back to a spreadsheet row and column. */
function locate(
  path: (string | number)[],
  group: Group,
): { row: number; column: ImportColumn | null } {
  const [field, index, sub] = path;
  if (field === "variants" && typeof index === "number") {
    const column =
      sub === "size" || sub === "colour" || sub === "sku" || sub === "stock" ? sub : null;
    return { row: group.rows[index]?.row ?? group.rows[0]!.row, column };
  }
  const column: Record<string, ImportColumn> = { packSize: "pack_size", isFeatured: "featured" };
  const key = typeof field === "string" ? (column[field] ?? field) : null;
  const known = PRODUCT_COLUMNS as readonly string[];
  return {
    row: group.rows[0]!.row,
    column: key && (known.includes(key) || key === "slug") ? (key as ImportColumn) : null,
  };
}

function buildGroup(key: string, title: string, rows: ParsedRow[]): Group {
  const first = rows[0]!.data;
  const group: Group = {
    key,
    title,
    rowNumbers: rows.map((r) => r.row),
    rows,
    issues: [],
    slug: first.slug || toSlug(first.title),
    categoryName: first.category || null,
  };

  for (const { row, data } of rows.slice(1)) {
    for (const col of PRODUCT_COLUMNS) {
      const value = data[col];
      if (!isBlank(value) && value !== first[col]) {
        group.issues.push(
          issue(row, col, `Differs from row ${rows[0]!.row}. Leave it blank or make it the same.`),
        );
      }
    }
  }

  const missing: ImportIssue[] = [];
  if (first.price === undefined) missing.push(issue(rows[0]!.row, "price", "Price is required"));
  rows.forEach(({ row, data }) => {
    if (data.stock === undefined) missing.push(issue(row, "stock", "Stock is required"));
  });
  group.issues.push(...missing);
  // Without a price or stock the product checks below only add noise.
  if (missing.length) return group;

  const parsed = productInputSchema.safeParse({
    title: first.title,
    slug: group.slug,
    description: first.description,
    categoryId: null,
    tags: first.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    price: first.price,
    mrp: first.mrp ?? null,
    fabric: first.fabric,
    care: first.care,
    isActive: first.active ?? true,
    isFeatured: first.featured ?? false,
    moq: first.moq ?? 1,
    packSize: first.pack_size ?? null,
    images: [],
    variants: rows.map(({ data }) => ({
      size: data.size || "Free size",
      colour: data.colour || "Default",
      sku: data.sku,
      stock: data.stock,
    })),
  });
  if (!parsed.success) {
    for (const i of parsed.error.issues) {
      const at = locate(i.path, group);
      group.issues.push(issue(at.row, at.column, i.message));
    }
    return group;
  }
  const { categoryId: _none, ...input } = parsed.data;
  // Still report everything found, but only error-free products can be imported.
  if (!group.issues.length) group.input = input;
  return group;
}

/** Slugs and SKUs must be new: in the file and in the store. Re-importing a file creates nothing. */
async function checkUniqueness(groups: Group[]): Promise<void> {
  const valid = groups.filter((g) => g.input);
  const slugs = valid.map((g) => g.slug);
  const skus = valid.flatMap((g) => g.input!.variants.flatMap((v) => (v.sku ? [v.sku] : [])));
  const [takenSlugs, takenSkus] = await Promise.all([
    Product.find({ slug: { $in: slugs } })
      .select("slug")
      .lean<{ slug: string }[]>(),
    Product.find({ "variants.sku": { $in: skus } })
      .select("variants.sku")
      .lean<{ variants: { sku?: string | null }[] }[]>(),
  ]);
  const slugSet = new Set(takenSlugs.map((p) => p.slug));
  const skuSet = new Set(takenSkus.flatMap((p) => p.variants.map((v) => v.sku ?? "")));

  const seenSlugs = new Map<string, number>();
  const seenSkus = new Map<string, number>();
  for (const g of valid) {
    const firstRow = g.rows[0]!.row;
    const slugColumn = g.rows[0]!.data.slug ? "slug" : "title";
    if (slugSet.has(g.slug)) {
      g.issues.push(issue(firstRow, slugColumn, `A product "${g.slug}" already exists`));
    } else if (seenSlugs.has(g.slug)) {
      g.issues.push(
        issue(firstRow, slugColumn, `Same URL as the product on row ${seenSlugs.get(g.slug)}`),
      );
    }
    seenSlugs.set(g.slug, firstRow);

    g.input!.variants.forEach((v, i) => {
      if (!v.sku) return;
      const row = g.rows[i]!.row;
      if (skuSet.has(v.sku)) g.issues.push(issue(row, "sku", `SKU ${v.sku} is already used`));
      else if (seenSkus.has(v.sku) && seenSkus.get(v.sku) !== row) {
        g.issues.push(issue(row, "sku", `SKU ${v.sku} is also on row ${seenSkus.get(v.sku)}`));
      }
      seenSkus.set(v.sku, row);
    });
  }
}

function result(g: Group, status: ImportProductResult["status"]): ImportProductResult {
  return {
    title: g.title,
    slug: g.slug,
    category: g.categoryName,
    price: g.rows[0]?.data.price ?? null,
    rows: g.rowNumbers,
    variantCount: g.rowNumbers.length,
    totalStock: g.rows.reduce((sum, r) => sum + (r.data.stock ?? 0), 0),
    status,
    issues: g.issues.sort((a, b) => a.row - b.row),
  };
}

/**
 * Validates every row, groups variants into products and, when `commit` is set, creates the
 * valid products. Invalid products are reported and skipped; the rest still import.
 */
export async function importProducts(input: {
  rows: { row: number; cells: Record<string, unknown> }[];
  commit: boolean;
}): Promise<ImportReport> {
  // 1. Parse rows; a row that fails parsing makes its whole product invalid.
  const groups = new Map<
    string,
    { title: string; rowNumbers: number[]; rows: ParsedRow[]; issues: ImportIssue[] }
  >();
  const untitled: ImportIssue[] = [];
  for (const { row, cells } of input.rows) {
    const parsed = importRowSchema.safeParse(cells);
    const title =
      typeof cells.title === "string" || typeof cells.title === "number"
        ? String(cells.title).trim()
        : "";
    const slug = typeof cells.slug === "string" ? cells.slug.trim() : "";
    const key = slug ? `slug:${slug}` : title ? `title:${title.toLowerCase()}` : "";
    if (!key) {
      untitled.push(issue(row, "title", "Title is required"));
      continue;
    }
    const g = groups.get(key) ?? { title, rowNumbers: [], rows: [], issues: [] };
    g.rowNumbers.push(row);
    if (parsed.success) g.rows.push({ row, data: parsed.data });
    else {
      for (const i of parsed.error.issues) {
        g.issues.push(issue(row, (i.path[0] as ImportColumn | undefined) ?? null, i.message));
      }
    }
    groups.set(key, g);
  }

  // 2. Build products.
  const built: Group[] = [...groups].map(([key, g]) => {
    if (g.issues.length || !g.rows.length) {
      return { ...g, key, slug: "", categoryName: null };
    }
    return buildGroup(key, g.title, g.rows);
  });
  await checkUniqueness(built);

  // 3. Categories by name, case-insensitive; unknown names are created on commit.
  const categories = await Category.find()
    .select("name")
    .lean<{ _id: Types.ObjectId; name: string }[]>();
  const categoryIds = new Map(categories.map((c) => [c.name.toLowerCase(), c._id]));
  const ready = built.filter((g) => g.input && !g.issues.length);
  const newCategories = [
    ...new Map(
      ready
        .flatMap((g) => (g.categoryName ? [g.categoryName] : []))
        .filter((name) => !categoryIds.has(name.toLowerCase()))
        .map((name) => [name.toLowerCase(), name]),
    ).values(),
  ];

  const statuses = new Map<Group, ImportProductResult["status"]>(
    built.map((g) => [g, g.input && !g.issues.length ? "ready" : "invalid"]),
  );

  // 4. Commit: categories first, then all ready products in one unordered insert.
  if (input.commit && ready.length) {
    for (const name of newCategories) {
      const created = await Category.create({ name, slug: await uniqueSlug(Category, name) });
      categoryIds.set(name.toLowerCase(), created._id);
    }
    const docs = ready.map((g) => ({
      ...g.input!,
      slug: g.slug,
      categoryId: g.categoryName ? (categoryIds.get(g.categoryName.toLowerCase()) ?? null) : null,
      variants: g.input!.variants.map(({ id: _id, ...v }) => v),
    }));
    const failed = new Map<number, string>();
    try {
      await Product.insertMany(docs, { ordered: false });
    } catch (err) {
      // A race (e.g. the same slug created meanwhile) fails only the affected products.
      if (!(err instanceof mongo.MongoBulkWriteError)) throw err;
      const writeErrors = Array.isArray(err.writeErrors) ? err.writeErrors : [err.writeErrors];
      for (const e of writeErrors) {
        failed.set(
          e.index,
          e.code === 11000 ? "Slug or SKU already exists" : (e.errmsg ?? "Failed"),
        );
      }
    }
    ready.forEach((g, i) => {
      const message = failed.get(i);
      if (message) g.issues.push(issue(g.rows[0]!.row, null, message));
      statuses.set(g, message ? "failed" : "created");
    });
  }

  const products = built.map((g) => result(g, statuses.get(g)!));
  if (untitled.length) {
    products.push({
      title: "(rows without a title)",
      slug: "",
      category: null,
      price: null,
      rows: untitled.map((u) => u.row),
      variantCount: 0,
      totalStock: 0,
      status: "invalid",
      issues: untitled,
    });
  }
  const count = (s: ImportProductResult["status"]) => products.filter((p) => p.status === s).length;
  return {
    committed: input.commit,
    products,
    newCategories,
    summary: {
      rows: input.rows.length,
      products: products.length,
      ready: count("ready"),
      invalid: count("invalid"),
      created: count("created"),
      failed: count("failed"),
    },
  };
}

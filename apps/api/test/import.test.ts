import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { Category, Product } from "../src/models/index.js";
import { clearDb, createOwner, loggedInAgent, startDb, testConfig } from "./helpers.js";

let stopDb: () => Promise<void>;
let app: ReturnType<typeof createApp>;
let admin: Awaited<ReturnType<typeof loggedInAgent>>;
const revalidate = vi.fn();

beforeAll(async () => {
  stopDb = await startDb();
});
afterAll(() => stopDb());
beforeEach(async () => {
  await clearDb();
  revalidate.mockClear();
  app = createApp(testConfig({ revalidate }));
  await createOwner();
  admin = await loggedInAgent(app);
});

type Cells = Record<string, string | number | boolean | null>;
/** Rows as the browser sends them: spreadsheet row numbers start at 2 (row 1 is the header). */
const rows = (...cells: Cells[]) => cells.map((c, i) => ({ row: i + 2, cells: c }));
const run = (cells: Cells[], commit = false) =>
  admin.post("/api/v1/admin/import/products").send({ rows: rows(...cells), commit });

const KURTI = { title: "Chikankari Kurti", category: "Kurtis", price: 1299, mrp: 1799 };

describe("bulk import preview", () => {
  it("groups variant rows into products without writing anything", async () => {
    const res = await run([
      { ...KURTI, tags: "cotton, summer", size: "M", colour: "White", stock: 5 },
      { title: "Chikankari Kurti", size: "L", colour: "White", stock: "3" },
      { title: "Silk Saree", price: "2,499.50", stock: 2, featured: "yes" },
    ]);
    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({
      rows: 3,
      products: 2,
      ready: 2,
      invalid: 0,
      created: 0,
      failed: 0,
    });
    expect(res.body.products[0]).toMatchObject({
      title: "Chikankari Kurti",
      slug: "chikankari-kurti",
      category: "Kurtis",
      price: 129900,
      rows: [2, 3],
      variantCount: 2,
      totalStock: 8,
      status: "ready",
    });
    expect(res.body.products[1]).toMatchObject({ price: 249950, status: "ready" });
    expect(res.body.newCategories).toEqual(["Kurtis"]);
    expect(await Product.countDocuments()).toBe(0);
    expect(await Category.countDocuments()).toBe(0);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("reports errors against the spreadsheet row and column", async () => {
    const res = await run([
      { ...KURTI, size: "M", colour: "White", stock: 5 },
      { title: "Chikankari Kurti", price: 999, size: "M", colour: "White", stock: 1 },
      { title: "No Price", stock: 1 },
      { title: "Bad Stock", price: 100, stock: "lots" },
      { title: "Cheap MRP", price: 500, mrp: 400, stock: 1 },
      { price: 100, stock: 1 },
    ]);
    const issues = (title: string) =>
      res.body.products.find((p: { title: string }) => p.title === title).issues;

    expect(issues("Chikankari Kurti")).toEqual([
      { row: 3, column: "price", message: expect.stringContaining("Differs from row 2") },
      { row: 3, column: "colour", message: "Duplicate size and colour" },
    ]);
    expect(issues("No Price")).toEqual([{ row: 4, column: "price", message: "Price is required" }]);
    expect(issues("Bad Stock")[0]).toMatchObject({ row: 5, column: "stock" });
    expect(issues("Cheap MRP")[0]).toMatchObject({ row: 6, column: "mrp" });
    expect(issues("(rows without a title)")).toEqual([
      { row: 7, column: "title", message: "Title is required" },
    ]);
    expect(res.body.summary.ready).toBe(0);
  });

  it("rejects slugs and SKUs that already exist or repeat in the file", async () => {
    await Product.create({
      title: "Old",
      slug: "silk-saree",
      price: 100000,
      variants: [{ size: "M", colour: "Red", sku: "SKU-1", stock: 1 }],
    });
    const res = await run([
      { title: "Silk Saree", price: 100, stock: 1 },
      { title: "Linen Set", price: 100, sku: "SKU-1", stock: 1 },
      { title: "Cotton Set", price: 100, sku: "SKU-2", stock: 1 },
      { title: "Rayon Set", price: 100, sku: "SKU-2", stock: 1 },
    ]);
    const messages = res.body.products.map((p: { issues: { message: string }[] }) =>
      p.issues.map((i) => i.message),
    );
    expect(messages).toEqual([
      ['A product "silk-saree" already exists'],
      ["SKU SKU-1 is already used"],
      [],
      ["SKU SKU-2 is also on row 4"],
    ]);
  });
});

describe("bulk import commit", () => {
  it("creates valid products and categories, skips invalid ones, and refreshes the store", async () => {
    await Category.create({ name: "Sarees", slug: "sarees" });
    const res = await run(
      [
        { ...KURTI, size: "M", colour: "White", sku: "CK-M", stock: 5 },
        { title: "Chikankari Kurti", size: "L", colour: "White", sku: "CK-L", stock: 3 },
        { title: "Silk Saree", category: "sarees", price: 2499, stock: 2, active: "no" },
        { title: "Broken", price: "free", stock: 1 },
      ],
      true,
    );
    expect(res.body.summary).toMatchObject({ created: 2, invalid: 1, failed: 0 });
    expect(res.body.newCategories).toEqual(["Kurtis"]);
    expect(revalidate).toHaveBeenCalledTimes(1);

    const kurti = await Product.findOne({ slug: "chikankari-kurti" }).lean();
    const kurtis = await Category.findOne({ name: "Kurtis" }).lean();
    expect(kurti).toMatchObject({
      price: 129900,
      mrp: 179900,
      isActive: true,
      categoryId: kurtis!._id,
      images: [],
    });
    expect(kurti!.variants.map((v) => [v.size, v.sku, v.stock])).toEqual([
      ["M", "CK-M", 5],
      ["L", "CK-L", 3],
    ]);

    // Existing category matched case-insensitively; "active: no" respected; default variant.
    const saree = await Product.findOne({ slug: "silk-saree" }).lean();
    const sarees = await Category.findOne({ slug: "sarees" }).lean();
    expect(saree).toMatchObject({ isActive: false, categoryId: sarees!._id });
    expect(saree!.variants[0]).toMatchObject({ size: "Free size", colour: "Default" });
    expect(await Category.countDocuments()).toBe(2);
  });

  it("creates nothing when the same file is imported twice", async () => {
    const file = [{ ...KURTI, stock: 5 }];
    expect((await run(file, true)).body.summary.created).toBe(1);
    const again = await run(file, true);
    expect(again.body.summary).toMatchObject({ created: 0, invalid: 1 });
    expect(await Product.countDocuments()).toBe(1);
  });

  it("requires the owner session and enforces the row limit", async () => {
    const anonymous = await request(app)
      .post("/api/v1/admin/import/products")
      .set("origin", "http://localhost:3000")
      .send({ rows: rows({ title: "A", price: 1, stock: 1 }) });
    expect(anonymous.status).toBe(401);

    const tooMany = Array.from({ length: 2001 }, () => ({ title: "A", price: 1, stock: 1 }));
    expect((await run(tooMany)).status).toBe(400);
  });
});

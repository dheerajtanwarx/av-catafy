import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { Catalogue, Category, Product, StoreSettings } from "../src/models/index.js";
import { clearDb, createOwner, loggedInAgent, startDb, testConfig } from "./helpers.js";

let stopDb: () => Promise<void>;
const revalidate = vi.fn();
const app = createApp(testConfig({ revalidate }));
const pub = (url: string) => request(app).get(`/api/v1/public${url}`);

beforeAll(async () => {
  stopDb = await startDb();
});
afterAll(() => stopDb());
beforeEach(async () => {
  await clearDb();
  revalidate.mockClear();
});

let n = 0;
function makeProduct(overrides: Record<string, unknown> = {}) {
  n += 1;
  return Product.create({
    title: `Product ${n}`,
    slug: `product-${n}`,
    price: 100000 + n * 1000,
    variants: [{ size: "M", colour: "Red", stock: 3 }],
    ...overrides,
  });
}

describe("product visibility", () => {
  it("never exposes inactive or soft-deleted products", async () => {
    const live = await makeProduct({ title: "Live" });
    const inactive = await makeProduct({ title: "Inactive", isActive: false });
    const deleted = await makeProduct({ title: "Deleted", deletedAt: new Date() });

    const list = await pub("/products");
    expect(list.body.items.map((p: { id: string }) => p.id)).toEqual([live.id]);

    expect((await pub(`/products/${live.slug}`)).status).toBe(200);
    expect((await pub(`/products/${inactive.slug}`)).status).toBe(404);
    expect((await pub(`/products/${deleted.slug}`)).status).toBe(404);
  });

  it("returns card fields without internal data", async () => {
    await makeProduct({
      title: "Kurti",
      price: 129900,
      mrp: 159900,
      variants: [{ size: "M", colour: "Red", sku: "SECRET-SKU", stock: 0 }],
    });
    const [card] = (await pub("/products")).body.items;
    expect(card).toMatchObject({ title: "Kurti", discountPercent: 19, inStock: false });
    expect(JSON.stringify(card)).not.toContain("SECRET-SKU");
  });

  it("does not leak SKUs on the product page", async () => {
    const p = await makeProduct({
      variants: [{ size: "M", colour: "Red", sku: "SECRET-SKU", stock: 2 }],
    });
    const res = await pub(`/products/${p.slug}`);
    expect(res.body.variants[0]).toEqual({
      id: expect.any(String),
      size: "M",
      colour: "Red",
      stock: 2,
    });
    expect(JSON.stringify(res.body)).not.toContain("SECRET-SKU");
  });
});

describe("listing", () => {
  it("filters by category slug, searches by substring and sorts by price", async () => {
    const kurtis = await Category.create({ name: "Kurtis", slug: "kurtis" });
    await makeProduct({ title: "Cotton Kurti", categoryId: kurtis._id, price: 90000 });
    await makeProduct({ title: "Silk Kurti", categoryId: kurtis._id, price: 150000 });
    await makeProduct({ title: "Banarasi Saree", tags: ["silk"], price: 300000 });

    const inCategory = await pub("/products?category=kurtis&sort=price_desc");
    expect(inCategory.body.items.map((p: { title: string }) => p.title)).toEqual([
      "Silk Kurti",
      "Cotton Kurti",
    ]);

    const search = await pub("/products?q=SILK&sort=price_asc");
    expect(search.body.items.map((p: { title: string }) => p.title)).toEqual([
      "Silk Kurti",
      "Banarasi Saree",
    ]);

    expect((await pub("/products?category=unknown")).body.total).toBe(0);
  });

  it("treats regex characters in search literally", async () => {
    await makeProduct({ title: "Kurti (Pack of 2)" });
    expect((await pub(`/products?q=${encodeURIComponent("(pack")}`)).body.total).toBe(1);
    expect((await pub(`/products?q=${encodeURIComponent(".*")}`)).body.total).toBe(0);
  });

  it("lists only categories that are active and have visible products", async () => {
    const withProducts = await Category.create({ name: "Kurtis", slug: "kurtis" });
    const hidden = await Category.create({ name: "Hidden", slug: "hidden", isActive: false });
    await Category.create({ name: "Empty", slug: "empty" });
    const onlyInactive = await Category.create({ name: "Drafts", slug: "drafts" });
    await makeProduct({ categoryId: withProducts._id });
    await makeProduct({ categoryId: hidden._id });
    await makeProduct({ categoryId: onlyInactive._id, isActive: false });

    const res = await pub("/categories");
    expect(res.body.items).toEqual([expect.objectContaining({ slug: "kurtis", productCount: 1 })]);
  });

  it("returns 404 for a malformed slug", async () => {
    expect((await pub("/products/NOT%20A%20SLUG")).status).toBe(404);
  });
});

describe("catalogues", () => {
  it("keeps the owner's product order and skips hidden products", async () => {
    const a = await makeProduct({ title: "A" });
    const b = await makeProduct({ title: "B" });
    const hidden = await makeProduct({ title: "Hidden", isActive: false });
    const c = await makeProduct({ title: "C" });
    await Catalogue.create({
      name: "Diwali",
      slug: "diwali",
      productIds: [c._id, hidden._id, a._id, b._id],
    });

    const res = await pub("/catalogues/diwali");
    expect(res.status).toBe(200);
    expect(res.body.products.map((p: { title: string }) => p.title)).toEqual(["C", "A", "B"]);
    expect(res.body.productCount).toBe(3);
  });

  it("hides private and inactive catalogues", async () => {
    const p = await makeProduct();
    await Catalogue.create({ name: "VIP", slug: "vip", isPrivate: true, productIds: [p._id] });
    await Catalogue.create({ name: "Old", slug: "old", isActive: false, productIds: [p._id] });

    expect((await pub("/catalogues/vip")).status).toBe(404);
    expect((await pub("/catalogues/old")).status).toBe(404);
    expect((await pub("/catalogues")).body.items).toEqual([]);
  });
});

describe("store and sitemap", () => {
  it("returns public store settings", async () => {
    await StoreSettings.create({ storeName: "Boutique", whatsappNumber: "9876543210" });
    const res = await pub("/store");
    expect(res.body).toMatchObject({
      storeName: "Boutique",
      whatsappNumber: "9876543210",
      currency: "INR",
    });
  });

  it("lists only visible pages", async () => {
    const live = await makeProduct();
    await makeProduct({ isActive: false });
    await Catalogue.create({ name: "Summer", slug: "summer", productIds: [live._id] });
    await Catalogue.create({ name: "VIP", slug: "vip", isPrivate: true });
    const paths = (await pub("/sitemap")).body.items.map((e: { path: string }) => e.path);
    expect(paths.sort()).toEqual([`/c/summer`, `/p/${live.slug}`]);
  });
});

describe("storefront revalidation", () => {
  it("fires after successful admin writes only", async () => {
    await createOwner();
    const admin = await loggedInAgent(app);

    await admin.get("/api/v1/admin/products");
    expect(revalidate).not.toHaveBeenCalled();

    await admin.post("/api/v1/admin/categories").send({ name: "" }); // 400
    expect(revalidate).not.toHaveBeenCalled();

    await admin.post("/api/v1/admin/categories").send({ name: "Sarees" });
    await vi.waitFor(() => expect(revalidate).toHaveBeenCalledTimes(1));
  });
});

describe("admin catalogues", () => {
  it("creates a catalogue with ordered products and rejects bad product ids", async () => {
    await createOwner();
    const admin = await loggedInAgent(app);
    const a = await makeProduct({ title: "A" });
    const b = await makeProduct({ title: "B" });

    const created = await admin
      .post("/api/v1/admin/catalogues")
      .send({ name: "Festive Edit", productIds: [b.id, a.id] });
    expect(created.status).toBe(201);
    expect(created.body.slug).toBe("festive-edit");
    expect(created.body.products.map((p: { title: string }) => p.title)).toEqual(["B", "A"]);

    const dupes = await admin
      .post("/api/v1/admin/catalogues")
      .send({ name: "X", productIds: [a.id, a.id] });
    expect(dupes.status).toBe(400);

    const missing = await admin
      .post("/api/v1/admin/catalogues")
      .send({ name: "X", productIds: ["64b7f0c2a1b2c3d4e5f60718"] });
    expect(missing.status).toBe(400);
  });

  it("drops soft-deleted products from a catalogue's list and count", async () => {
    await createOwner();
    const admin = await loggedInAgent(app);
    const a = await makeProduct({ title: "A" });
    const b = await makeProduct({ title: "B" });
    const cat = (
      await admin.post("/api/v1/admin/catalogues").send({ name: "Edit", productIds: [a.id, b.id] })
    ).body;
    await admin.delete(`/api/v1/admin/products/${a.id}`);

    const res = await admin.get(`/api/v1/admin/catalogues/${cat.id}`);
    expect(res.body.products.map((p: { title: string }) => p.title)).toEqual(["B"]);
    expect(res.body.productCount).toBe(1);
  });
});

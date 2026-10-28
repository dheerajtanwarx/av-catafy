import type { ProductInput } from "@catafy/types";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { Product } from "../src/models/index.js";
import { clearDb, createOwner, loggedInAgent, startDb, testConfig } from "./helpers.js";

let stopDb: () => Promise<void>;
let admin: Awaited<ReturnType<typeof loggedInAgent>>;
const app = createApp(testConfig());

beforeAll(async () => {
  stopDb = await startDb();
});
afterAll(() => stopDb());
beforeEach(async () => {
  await clearDb();
  await createOwner();
  admin = await loggedInAgent(app);
});

const IMAGE = {
  key: "products/0b6f8c1e-2d4a-4f7e-9c3b-1a2b3c4d5e6f.jpg",
  width: 1200,
  height: 1600,
  alt: "",
};

function productInput(overrides: Partial<ProductInput> = {}): ProductInput {
  return {
    title: "Chikankari Cotton Kurti",
    price: 129900,
    mrp: 159900,
    images: [IMAGE],
    variants: [
      { size: "M", colour: "White", sku: "CK-M-W", stock: 5 },
      { size: "L", colour: "White", sku: "CK-L-W", stock: 3 },
    ],
    ...overrides,
  };
}

describe("products", () => {
  it("creates a product with a slug derived from the title", async () => {
    const res = await admin.post("/api/v1/admin/products").send(productInput());
    expect(res.status).toBe(201);
    expect(res.body.slug).toBe("chikankari-cotton-kurti");
    expect(res.body.totalStock).toBe(8);
    expect(res.body.variants).toHaveLength(2);
  });

  it("creates a product without optional MRP or images", async () => {
    const res = await admin
      .post("/api/v1/admin/products")
      .send({
        title: "Plain",
        price: 50000,
        variants: [{ size: "Free", colour: "Black", stock: 0 }],
      });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ mrp: null, images: [], packSize: null, categoryId: null });
  });

  it("de-duplicates slugs", async () => {
    await admin.post("/api/v1/admin/products").send(productInput());
    const second = await admin
      .post("/api/v1/admin/products")
      .send(productInput({ variants: [{ size: "S", colour: "Pink", stock: 1 }] }));
    expect(second.body.slug).toBe("chikankari-cotton-kurti-2");
  });

  it.each([
    ["MRP below price", { mrp: 100000 }],
    ["fractional paise", { price: 1299.5 }],
    ["no variants", { variants: [] }],
    [
      "duplicate size/colour",
      {
        variants: [
          { size: "M", colour: "Red", stock: 1 },
          { size: "m", colour: "red", stock: 2 },
        ],
      },
    ],
    ["negative stock", { variants: [{ size: "M", colour: "Red", stock: -1 }] }],
    ["an image key the API didn't issue", { images: [{ ...IMAGE, key: "../../etc/passwd" }] }],
  ])("rejects %s", async (_label, overrides) => {
    const res = await admin.post("/api/v1/admin/products").send(productInput(overrides));
    expect(res.status).toBe(400);
  });

  it("returns 409 when a SKU is already used by another product", async () => {
    await admin.post("/api/v1/admin/products").send(productInput());
    const res = await admin.post("/api/v1/admin/products").send(
      productInput({
        title: "Other",
        variants: [{ size: "M", colour: "W", sku: "CK-M-W", stock: 1 }],
      }),
    );
    expect(res.status).toBe(409);
  });

  it("keeps existing variant ids on update and adds new ones", async () => {
    const created = (await admin.post("/api/v1/admin/products").send(productInput())).body;
    const [m] = created.variants;
    const res = await admin.put(`/api/v1/admin/products/${created.id}`).send(
      productInput({
        variants: [
          { id: m.id, size: "M", colour: "White", sku: "CK-M-W", stock: 10 },
          { size: "XL", colour: "White", stock: 2 },
        ],
      }),
    );
    expect(res.status).toBe(200);
    expect(res.body.variants[0]).toMatchObject({ id: m.id, stock: 10 });
    expect(res.body.variants[1].id).not.toBe(created.variants[1].id);
  });

  it("rejects a variant id from another product", async () => {
    const a = (await admin.post("/api/v1/admin/products").send(productInput())).body;
    const b = (
      await admin
        .post("/api/v1/admin/products")
        .send(productInput({ title: "B", variants: [{ size: "S", colour: "Blue", stock: 1 }] }))
    ).body;
    const res = await admin
      .put(`/api/v1/admin/products/${a.id}`)
      .send(
        productInput({ variants: [{ id: b.variants[0].id, size: "S", colour: "Blue", stock: 1 }] }),
      );
    expect(res.status).toBe(400);
  });

  it("soft deletes: hidden from the API, kept in the DB, slug and SKUs freed", async () => {
    const created = (await admin.post("/api/v1/admin/products").send(productInput())).body;
    expect((await admin.delete(`/api/v1/admin/products/${created.id}`)).status).toBe(204);

    expect((await admin.get(`/api/v1/admin/products/${created.id}`)).status).toBe(404);
    expect((await admin.get("/api/v1/admin/products")).body.total).toBe(0);
    const raw = await Product.findById(created.id).lean();
    expect(raw?.deletedAt).toBeInstanceOf(Date);

    const again = await admin.post("/api/v1/admin/products").send(productInput());
    expect(again.status).toBe(201);
    expect(again.body.slug).toBe("chikankari-cotton-kurti");
  });

  it("lists with search, status filter and pagination", async () => {
    await admin.post("/api/v1/admin/products").send(productInput());
    await admin.post("/api/v1/admin/products").send(
      productInput({
        title: "Silk Saree",
        isActive: false,
        variants: [{ size: "Free", colour: "Red", stock: 1 }],
      }),
    );

    const search = await admin.get("/api/v1/admin/products?q=chikan");
    expect(search.body.items.map((p: { title: string }) => p.title)).toEqual([
      "Chikankari Cotton Kurti",
    ]);

    const inactive = await admin.get("/api/v1/admin/products?status=inactive");
    expect(inactive.body.total).toBe(1);

    const page = await admin.get("/api/v1/admin/products?limit=1&page=2");
    expect(page.body).toMatchObject({ page: 2, limit: 1, total: 2, totalPages: 2 });
    expect(page.body.items).toHaveLength(1);
  });

  it("returns 404 for a malformed id", async () => {
    expect((await admin.get("/api/v1/admin/products/not-an-id")).status).toBe(404);
  });
});

describe("categories", () => {
  it("creates, lists with product counts, and blocks deleting a category in use", async () => {
    const cat = (await admin.post("/api/v1/admin/categories").send({ name: "Kurtis" })).body;
    expect(cat.slug).toBe("kurtis");

    await admin.post("/api/v1/admin/products").send(productInput({ categoryId: cat.id }));
    const list = await admin.get("/api/v1/admin/categories");
    expect(list.body.items[0]).toMatchObject({ name: "Kurtis", productCount: 1 });

    const del = await admin.delete(`/api/v1/admin/categories/${cat.id}`);
    expect(del.status).toBe(409);
  });

  it("rejects a product pointing at a missing category", async () => {
    const res = await admin
      .post("/api/v1/admin/products")
      .send(productInput({ categoryId: "64b7f0c2a1b2c3d4e5f60718" }));
    expect(res.status).toBe(400);
  });

  it("deletes an empty category", async () => {
    const cat = (await admin.post("/api/v1/admin/categories").send({ name: "Empty" })).body;
    expect((await admin.delete(`/api/v1/admin/categories/${cat.id}`)).status).toBe(204);
  });
});

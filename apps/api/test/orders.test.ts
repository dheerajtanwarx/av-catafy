import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { Counter, Customer, Order, Product } from "../src/models/index.js";
import { clearDb, startDb, testConfig } from "./helpers.js";

let stopDb: () => Promise<void>;
let app: ReturnType<typeof createApp>;
const revalidate = vi.fn();

beforeAll(async () => {
  stopDb = await startDb();
});
afterAll(() => stopDb());
beforeEach(async () => {
  await clearDb();
  revalidate.mockClear();
  app = createApp(testConfig({ revalidate })); // fresh rate limiters
});

const CUSTOMER = {
  name: "Priya Sharma",
  phone: "+91 98765 43210",
  line1: "12 MG Road, Flat 4B",
  city: "Lucknow",
  pincode: "226001",
};

let n = 0;
async function makeProduct(overrides: Record<string, unknown> = {}) {
  n += 1;
  const p = await Product.create({
    title: `Kurti ${n}`,
    slug: `kurti-${n}`,
    price: 129900,
    images: [
      { key: "products/0b6f8c1e-2d4a-4f7e-9c3b-1a2b3c4d5e6f.jpg", width: 1200, height: 1600 },
    ],
    variants: [
      { size: "M", colour: "White", stock: 5 },
      { size: "L", colour: "White", stock: 1 },
    ],
    ...overrides,
  });
  const [m, l] = p.variants;
  return { p, m: m!, l: l! };
}

type HasId = { _id: { toString(): string } };
const item = (p: HasId, v: HasId, quantity = 1) => ({
  productId: p._id.toString(),
  variantId: v._id.toString(),
  quantity,
});

const quote = (items: object[]) => request(app).post("/api/v1/public/cart/quote").send({ items });
const order = (items: object[], customer: object = CUSTOMER, note = "") =>
  request(app).post("/api/v1/public/orders").send({ customer, items, note });

async function stockOf(productId: string) {
  const p = await Product.findById(productId).lean();
  return p!.variants.map((v) => v.stock);
}

describe("cart quote", () => {
  it("prices from the database and ignores client-sent prices", async () => {
    const { p, m } = await makeProduct();
    const res = await quote([{ ...item(p, m, 2), unitPrice: 1 }]);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ subtotal: 259800, total: 259800, orderable: true });
    expect(res.body.lines[0]).toMatchObject({
      unitPrice: 129900,
      lineTotal: 259800,
      issue: null,
      available: 5,
    });
  });

  it("merges repeated lines for the same variant", async () => {
    const { p, m } = await makeProduct();
    const res = await quote([item(p, m, 1), item(p, m, 2)]);
    expect(res.body.lines).toHaveLength(1);
    expect(res.body.lines[0].quantity).toBe(3);
  });

  it("flags unavailable, out of stock and insufficient stock lines", async () => {
    const { p, m, l } = await makeProduct();
    const hidden = await makeProduct({ isActive: false });
    const deleted = await makeProduct({ deletedAt: new Date() });
    await Product.updateOne(
      { _id: p._id, "variants._id": m._id },
      { $set: { "variants.$.stock": 0 } },
    );

    const res = await quote([
      item(p, m, 1),
      item(p, l, 2),
      item(hidden.p, hidden.m),
      item(deleted.p, deleted.m),
      { productId: p.id, variantId: "64b7f0c2a1b2c3d4e5f60718", quantity: 1 },
    ]);
    expect(res.body.lines.map((x: { issue: string }) => x.issue)).toEqual([
      "out_of_stock",
      "insufficient_stock",
      "unavailable",
      "unavailable",
      "unavailable",
    ]);
    expect(res.body.orderable).toBe(false);
  });

  it("applies the minimum order quantity across all variants of a product", async () => {
    const { p, m, l } = await makeProduct({ moq: 3 });
    expect((await quote([item(p, m, 2)])).body.lines[0].issue).toBe("below_moq");
    const combined = await quote([item(p, m, 2), item(p, l, 1)]);
    expect(combined.body.orderable).toBe(true);
  });
});

describe("placing an order", () => {
  it("creates a PENDING/UNPAID order, reserves stock and upserts the customer", async () => {
    const { p, m, l } = await makeProduct();
    const res = await order(
      [item(p, m, 2), item(p, l, 1)],
      CUSTOMER,
      "Please call before delivery",
    );
    expect(res.status).toBe(201);
    expect(res.body.orderNumber).toMatch(/^ORD-\d{4}-00001$/);
    expect(res.body.token).toMatch(/^[A-Za-z0-9_-]{24}$/);

    expect(await stockOf(p.id)).toEqual([3, 0]);

    const saved = await Order.findOne({ orderNumber: res.body.orderNumber }).lean();
    expect(saved).toMatchObject({
      status: "PENDING",
      paymentStatus: "UNPAID",
      subtotal: 389700,
      total: 389700,
    });
    expect(saved!.items[0]).toMatchObject({
      title: p.title,
      unitPrice: 129900,
      quantity: 2,
      lineTotal: 259800,
    });
    expect(saved!.statusHistory.map((h) => h.status)).toEqual(["PENDING"]);

    const customer = await Customer.findById(saved!.customerId).lean();
    expect(customer).toMatchObject({ phone: "9876543210", name: "Priya Sharma" });

    // Stock changed: the storefront cache must refresh.
    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it("reuses the customer for the same phone and updates their name and address", async () => {
    const { p, m } = await makeProduct();
    await order([item(p, m)]);
    await order([item(p, m)], {
      ...CUSTOMER,
      phone: "9876543210",
      name: "Priya S.",
      city: "Kanpur",
    });
    expect(await Customer.countDocuments()).toBe(1);
    expect(await Customer.findOne().lean()).toMatchObject({
      name: "Priya S.",
      lastAddress: { city: "Kanpur" },
    });
  });

  it("rejects the whole order and changes nothing when any line lacks stock", async () => {
    const { p, m, l } = await makeProduct();
    const res = await order([item(p, m, 2), item(p, l, 2)]);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("OUT_OF_STOCK");
    expect(res.body.error.details.lines).toEqual([
      expect.objectContaining({
        variantId: l._id.toString(),
        issue: "insufficient_stock",
        available: 1,
      }),
    ]);
    expect(await stockOf(p.id)).toEqual([5, 1]);
    expect(await Order.countDocuments()).toBe(0);
    expect(await Customer.countDocuments()).toBe(0);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("never oversells: concurrent buyers race for the last piece", async () => {
    const { p, l } = await makeProduct(); // L has stock 1
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        order([item(p, l)], { ...CUSTOMER, phone: `98765432${10 + i}` }),
      ),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409, 409, 409, 409]);
    expect((await stockOf(p.id))[1]).toBe(0);
    expect(await Order.countDocuments()).toBe(1);
    // Failed transactions roll back the counter too, so numbering stays contiguous.
    expect(await Counter.findOne().lean()).toMatchObject({ seq: 1 });
  });

  it("keeps the order snapshot when the product changes later", async () => {
    const { p, m } = await makeProduct();
    const res = await order([item(p, m)]);
    await Product.updateOne({ _id: p._id }, { $set: { title: "Renamed", price: 1 } });
    const saved = await Order.findOne({ orderNumber: res.body.orderNumber }).lean();
    expect(saved!.items[0]).toMatchObject({ title: p.title, unitPrice: 129900 });
  });

  it("rejects orders below the minimum quantity", async () => {
    const { p, m } = await makeProduct({ moq: 2 });
    const res = await order([item(p, m, 1)]);
    expect(res.status).toBe(409);
    expect(res.body.error.details.lines[0]).toMatchObject({ issue: "below_moq", moq: 2 });
  });

  it("validates customer details", async () => {
    const { p, m } = await makeProduct();
    const res = await order([item(p, m)], { ...CUSTOMER, phone: "12345", pincode: "abc" });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details.fieldErrors)).toContain("customer");
  });

  it("rate limits order placement", async () => {
    const { p, m } = await makeProduct({ variants: [{ size: "M", colour: "W", stock: 100 }] });
    for (let i = 0; i < 10; i++) await order([item(p, m)]);
    const res = await order([item(p, m)]);
    expect(res.status).toBe(429);
  });
});

describe("order confirmation", () => {
  it("is available by token only", async () => {
    const { p, m } = await makeProduct();
    const { body } = await order([item(p, m, 2)]);

    const res = await request(app).get(`/api/v1/public/orders/${body.token}`);
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toContain("no-store");
    expect(res.body).toMatchObject({
      orderNumber: body.orderNumber,
      total: 259800,
      customer: { name: "Priya Sharma", phone: "9876543210" },
    });
    expect(res.body.items[0]).toMatchObject({
      quantity: 2,
      imageKey: expect.stringMatching(/^products\//),
    });

    expect((await request(app).get(`/api/v1/public/orders/${body.orderNumber}`)).status).toBe(404);
    expect((await request(app).get(`/api/v1/public/orders/${"x".repeat(24)}`)).status).toBe(404);
  });
});

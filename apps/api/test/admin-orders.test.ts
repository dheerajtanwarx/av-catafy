import { Types } from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { Order, Product, StoreSettings } from "../src/models/index.js";
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
  await StoreSettings.create({ storeName: "Test Store", gstin: "09ABCDE1234F1Z5" });
  admin = await loggedInAgent(app);
});

const PRIYA = {
  name: "Priya Sharma",
  phone: "9876543210",
  line1: "12 MG Road, Flat 4B",
  city: "Lucknow",
  pincode: "226001",
};
const MEERA = { ...PRIYA, name: "Meera Iyer", phone: "9123456780", city: "Chennai" };

async function makeProduct() {
  const p = await Product.create({
    title: "Chikankari Kurti",
    slug: `kurti-${Math.random().toString(36).slice(2, 8)}`,
    price: 100000,
    variants: [
      { size: "M", colour: "White", stock: 5 },
      { size: "L", colour: "White", stock: 3 },
    ],
  });
  return { p, m: p.variants[0]!, l: p.variants[1]! };
}

async function placeOrder(customer = PRIYA, mQty = 2, lQty = 1) {
  const { p, m, l } = await makeProduct();
  const res = await request(app)
    .post("/api/v1/public/orders")
    .send({
      customer,
      items: [
        { productId: p._id.toString(), variantId: m._id.toString(), quantity: mQty },
        { productId: p._id.toString(), variantId: l._id.toString(), quantity: lQty },
      ],
    });
  expect(res.status).toBe(201);
  const order = await Order.findOne({ orderNumber: res.body.orderNumber }).lean();
  revalidate.mockClear(); // placing an order revalidates too; tests check admin calls only
  return { id: order!._id.toString(), orderNumber: res.body.orderNumber as string, p };
}

async function stockOf(productId: unknown) {
  const p = await Product.findById(productId).lean();
  return p!.variants.map((v) => v.stock);
}

const setStatus = (id: string, status: string) =>
  admin.post(`/api/v1/admin/orders/${id}/status`).send({ status });

describe("admin orders: access", () => {
  it("requires the owner session", async () => {
    const { id } = await placeOrder();
    expect((await request(app).get("/api/v1/admin/orders")).status).toBe(401);
    expect((await request(app).get(`/api/v1/admin/orders/${id}`)).status).toBe(401);
  });

  it("returns 404 for unknown and malformed ids", async () => {
    expect((await admin.get("/api/v1/admin/orders/64b7f0c2a1b2c3d4e5f60718")).status).toBe(404);
    expect((await admin.get("/api/v1/admin/orders/nope")).status).toBe(404);
  });
});

describe("admin orders: status workflow", () => {
  it("moves forward, records history and lists allowed next steps", async () => {
    const { id } = await placeOrder();
    const res = await setStatus(id, "CONFIRMED");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("CONFIRMED");
    expect(res.body.statusHistory.map((h: { status: string }) => h.status)).toEqual([
      "PENDING",
      "CONFIRMED",
    ]);
    expect(res.body.nextStatuses).toEqual(["PACKED", "SHIPPED", "DELIVERED", "CANCELLED"]);
    // Non-cancel transitions don't touch stock or the storefront.
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("rejects moving backwards and leaving a final status", async () => {
    const { id } = await placeOrder();
    await setStatus(id, "SHIPPED");
    const back = await setStatus(id, "CONFIRMED");
    expect(back.status).toBe(409);
    expect(back.body.error.details.allowed).toEqual(["DELIVERED", "CANCELLED"]);

    await setStatus(id, "DELIVERED");
    expect((await setStatus(id, "CANCELLED")).status).toBe(409);
  });

  it("rejects unknown statuses", async () => {
    const { id } = await placeOrder();
    expect((await setStatus(id, "LOST")).status).toBe(400);
  });
});

describe("admin orders: cancellation restores stock", () => {
  it("returns every line's stock once and refreshes the storefront", async () => {
    const { id, p } = await placeOrder(PRIYA, 2, 1);
    expect(await stockOf(p._id)).toEqual([3, 2]);

    const res = await setStatus(id, "CONFIRMED").then(() => setStatus(id, "CANCELLED"));
    expect(res.status).toBe(200);
    expect(res.body.stockRestoredAt).not.toBeNull();
    expect(await stockOf(p._id)).toEqual([5, 3]);
    expect(revalidate).toHaveBeenCalledTimes(1);

    expect((await setStatus(id, "CANCELLED")).status).toBe(409);
    expect(await stockOf(p._id)).toEqual([5, 3]);
  });

  it("restores stock exactly once when two tabs cancel at the same time", async () => {
    const { id, p } = await placeOrder(PRIYA, 2, 1);
    const results = await Promise.all(Array.from({ length: 4 }, () => setStatus(id, "CANCELLED")));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.every((r) => r.status === 200 || r.status === 409)).toBe(true);
    expect(await stockOf(p._id)).toEqual([5, 3]);
  });

  it("still restores stock for a product that was deleted after the order", async () => {
    const { id, p } = await placeOrder(PRIYA, 2, 1);
    await admin.delete(`/api/v1/admin/products/${p._id.toString()}`);
    await setStatus(id, "CANCELLED");
    expect(await stockOf(p._id)).toEqual([5, 3]);
  });
});

describe("admin orders: payment and shipping", () => {
  it("derives payment status from the amount received", async () => {
    const { id } = await placeOrder(PRIYA, 2, 1); // total ₹3,000
    const patch = (body: object) => admin.patch(`/api/v1/admin/orders/${id}`).send(body);

    let res = await patch({ amountReceived: 100000, paymentNotes: "UPI ref 1234" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      paymentStatus: "PARTIAL",
      amountReceived: 100000,
      paymentNotes: "UPI ref 1234",
    });

    res = await patch({ amountReceived: 300000 });
    expect(res.body.paymentStatus).toBe("PAID");
    expect(res.body.paymentNotes).toBe("UPI ref 1234"); // untouched by a partial update

    res = await patch({ amountReceived: 0 });
    expect(res.body.paymentStatus).toBe("UNPAID");
  });

  it("saves courier, tracking and internal notes", async () => {
    const { id } = await placeOrder();
    const res = await admin
      .patch(`/api/v1/admin/orders/${id}`)
      .send({ courier: "Delhivery", trackingNumber: "DL123", internalNotes: "Gift wrap" });
    expect(res.body).toMatchObject({
      courier: "Delhivery",
      trackingNumber: "DL123",
      internalNotes: "Gift wrap",
    });
  });

  it("rejects fractional paise and empty updates", async () => {
    const { id } = await placeOrder();
    expect((await admin.patch(`/api/v1/admin/orders/${id}`).send({})).status).toBe(400);
    expect(
      (await admin.patch(`/api/v1/admin/orders/${id}`).send({ amountReceived: 10.5 })).status,
    ).toBe(400);
  });
});

describe("admin orders: list and print", () => {
  it("filters by status and searches order number, name and phone", async () => {
    const a = await placeOrder(PRIYA);
    const b = await placeOrder(MEERA);
    await setStatus(b.id, "CONFIRMED");

    const list = async (query: Record<string, string>) =>
      (await admin.get("/api/v1/admin/orders").query(query)).body as {
        total: number;
        items: { orderNumber: string; itemCount: number }[];
      };

    expect((await list({})).items.map((o) => o.orderNumber)).toEqual([
      b.orderNumber,
      a.orderNumber,
    ]);
    expect((await list({})).items[0]!.itemCount).toBe(3);
    expect((await list({ status: "CONFIRMED" })).items.map((o) => o.orderNumber)).toEqual([
      b.orderNumber,
    ]);
    expect((await list({ q: "meera" })).total).toBe(1);
    expect((await list({ q: "+91 98765 43210" })).items[0]!.orderNumber).toBe(a.orderNumber);
    expect((await list({ q: a.orderNumber.slice(-5) })).total).toBe(1);
    expect((await list({ paymentStatus: "PAID" })).total).toBe(0);
  });

  it("filters by calendar day in Indian time", async () => {
    const { id } = await placeOrder();
    // 20:00 UTC on 1 Jan is 01:30 IST on 2 Jan.
    // Raw driver call: Mongoose treats createdAt as immutable.
    await Order.collection.updateOne(
      { _id: new Types.ObjectId(id) },
      { $set: { createdAt: new Date("2026-01-01T20:00:00Z") } },
    );
    const count = async (from: string, to: string) =>
      (await admin.get("/api/v1/admin/orders").query({ from, to })).body.total;
    expect(await count("2026-01-02", "2026-01-02")).toBe(1);
    expect(await count("2026-01-01", "2026-01-01")).toBe(0);
  });

  it("returns the order with the store header for printing", async () => {
    const { id } = await placeOrder();
    const res = await admin.get(`/api/v1/admin/orders/${id}/print`);
    expect(res.status).toBe(200);
    expect(res.body.store).toMatchObject({ storeName: "Test Store", gstin: "09ABCDE1234F1Z5" });
    expect(res.body.order.items).toHaveLength(2);
  });
});

describe("admin customers", () => {
  it("aggregates order count and spend, excluding cancelled orders", async () => {
    const first = await placeOrder(PRIYA, 1, 1); // ₹2,000
    await placeOrder(PRIYA, 2, 1); // ₹3,000
    const cancelled = await placeOrder(PRIYA, 1, 1); // ₹2,000, cancelled below
    await placeOrder(MEERA, 1, 1);
    await setStatus(cancelled.id, "CANCELLED");

    const list = await admin.get("/api/v1/admin/customers");
    expect(list.body.total).toBe(2);
    // Most recent order first: Meera ordered last.
    expect(list.body.items.map((c: { name: string }) => c.name)).toEqual([
      "Meera Iyer",
      "Priya Sharma",
    ]);

    const priya = list.body.items[1];
    expect(priya).toMatchObject({ orderCount: 3, totalSpent: 500000, city: "Lucknow" });

    const detail = await admin.get(`/api/v1/admin/customers/${priya.id}`);
    expect(detail.body).toMatchObject({ phone: "9876543210", totalSpent: 500000 });

    const history = await admin
      .get("/api/v1/admin/orders")
      .query({ customerId: priya.id as string });
    expect(history.body.total).toBe(3);
    expect(history.body.items.at(-1).orderNumber).toBe(first.orderNumber);
  });

  it("searches by name or phone and saves notes", async () => {
    await placeOrder(PRIYA);
    await placeOrder(MEERA);
    expect((await admin.get("/api/v1/admin/customers").query({ q: "91234" })).body.total).toBe(1);
    const res = await admin.get("/api/v1/admin/customers").query({ q: "priya" });
    expect(res.body.total).toBe(1);

    const id = res.body.items[0].id as string;
    const saved = await admin.patch(`/api/v1/admin/customers/${id}`).send({ notes: "Prefers COD" });
    expect(saved.status).toBe(200);
    expect(saved.body.notes).toBe("Prefers COD");
  });
});

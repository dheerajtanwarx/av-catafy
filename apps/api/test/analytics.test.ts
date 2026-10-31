import { Types } from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { AnalyticsEvent, Catalogue, Order, Product, StoreSettings } from "../src/models/index.js";
import { deviceFromUserAgent, getReports } from "../src/services/analytics.service.js";
import { clearDb, createOwner, loggedInAgent, startDb, testConfig } from "./helpers.js";

let stopDb: () => Promise<void>;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  stopDb = await startDb();
});
afterAll(() => stopDb());
beforeEach(async () => {
  await clearDb();
  app = createApp(testConfig());
});

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/129 Safari/537.36";

const track = (body: object, ua = IPHONE) =>
  request(app)
    .post("/api/v1/public/events")
    .set("user-agent", ua)
    .send({ visitorId: "visitor-aaaa", sessionId: "session-aaaa", path: "/", ...body });

async function makeProduct(slug = "kurti") {
  return Product.create({
    title: "Chikankari Kurti",
    slug,
    price: 100000,
    variants: [{ size: "M", colour: "White", stock: 5 }],
  });
}

describe("event tracking", () => {
  it("stores events with resolved ids and a coarse device, never the IP", async () => {
    const p = await makeProduct();
    expect(
      (
        await track({
          type: "product_view",
          productSlug: "kurti",
          path: "/p/kurti",
          referrer: "L.Instagram.com",
        })
      ).status,
    ).toBe(204);
    const [e] = await AnalyticsEvent.find().lean();
    expect(e).toMatchObject({
      type: "product_view",
      productId: p._id,
      device: "mobile",
      referrer: "l.instagram.com",
    });
    expect(JSON.stringify(e)).not.toMatch(/127\.0\.0\.1|::1|ffff/);
  });

  it("drops bots, unknown pages, the logged-in owner and repeat order events", async () => {
    await makeProduct();
    await track({ type: "page_view" }, "WhatsApp/2.23 A");
    await track({ type: "product_view", productSlug: "missing" });
    await track({ type: "product_view" });

    await createOwner();
    const owner = await loggedInAgent(app);
    await owner.post("/api/v1/public/events").set("user-agent", MAC).send({
      type: "page_view",
      visitorId: "owner-visitor",
      sessionId: "owner-session",
      path: "/",
    });
    expect(await AnalyticsEvent.countDocuments()).toBe(0);

    await Order.collection.insertOne({ publicToken: "A".repeat(24), orderNumber: "ORD-1" });
    await track({ type: "order_placed", orderToken: "A".repeat(24) });
    await track({ type: "order_placed", orderToken: "A".repeat(24) });
    expect(await AnalyticsEvent.countDocuments({ type: "order_placed" })).toBe(1);
  });

  it("validates input", async () => {
    expect((await track({ type: "purchase" })).status).toBe(400);
    expect((await track({ type: "page_view", visitorId: "x" })).status).toBe(400);
    expect((await track({ type: "page_view", path: "https://evil.example" })).status).toBe(400);
  });

  it("classifies devices", () => {
    expect(deviceFromUserAgent(IPHONE)).toBe("mobile");
    expect(deviceFromUserAgent("Mozilla/5.0 (Linux; Android 14; SM-X710) Safari")).toBe("tablet");
    expect(deviceFromUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari")).toBe(
      "mobile",
    );
    expect(deviceFromUserAgent(MAC)).toBe("desktop");
  });
});

describe("live visitors", () => {
  it("shows each recent visitor's current page and how long they've been on it", async () => {
    await createOwner();
    const admin = await loggedInAgent(app);
    const p = await makeProduct();
    const c = await Catalogue.create({ name: "Festive", slug: "festive" });
    const ago = (s: number) => new Date(Date.now() - s * 1000);
    await AnalyticsEvent.insertMany([
      // Visitor A: catalogue → product → added to bag.
      {
        type: "catalogue_view",
        visitorId: "a",
        sessionId: "s-a",
        path: "/c/festive",
        catalogueId: c._id,
        device: "mobile",
        referrer: "wa.me",
        createdAt: ago(200),
      },
      {
        type: "product_view",
        visitorId: "a",
        sessionId: "s-a",
        path: "/p/kurti",
        productId: p._id,
        device: "mobile",
        createdAt: ago(90),
      },
      {
        type: "add_to_cart",
        visitorId: "a",
        sessionId: "s-a",
        path: "/p/kurti",
        productId: p._id,
        device: "mobile",
        createdAt: ago(30),
      },
      // Visitor B: checking out.
      {
        type: "checkout_started",
        visitorId: "b",
        sessionId: "s-b",
        path: "/checkout",
        device: "desktop",
        createdAt: ago(10),
      },
      // Visitor C: left 10 minutes ago.
      {
        type: "page_view",
        visitorId: "c",
        sessionId: "s-c",
        path: "/",
        device: "desktop",
        createdAt: ago(600),
      },
    ]);

    const res = await admin.get("/api/v1/admin/analytics/live");
    expect(res.status).toBe(200);
    expect(res.body.visitors.map((v: { visitorId: string }) => v.visitorId)).toEqual(["b", "a"]);
    const a = res.body.visitors[1];
    expect(a).toMatchObject({
      device: "mobile",
      referrer: "wa.me",
      page: { type: "product_view", label: "Chikankari Kurti" },
      pagesViewed: 2,
      addedToCart: true,
      checkingOut: false,
    });
    // Time on page counts from opening the product, not from adding to bag.
    expect(Date.parse(a.pageSince)).toBeLessThan(Date.parse(a.lastSeen));
    expect(res.body.visitors[0]).toMatchObject({ checkingOut: true, page: { label: "Checkout" } });
  });

  it("requires the owner session", async () => {
    expect((await request(app).get("/api/v1/admin/analytics/live")).status).toBe(401);
  });
});

describe("reports", () => {
  // 29 Oct 2026, 12:00 IST.
  const NOW = new Date("2026-10-29T06:30:00Z");
  const at = (iso: string) => new Date(iso);

  async function seedReportData() {
    const p = await makeProduct();
    const q = await makeProduct("saree");
    const order = (createdAt: Date, total: number, status = "PENDING", productId = p._id) =>
      Order.collection.insertOne({
        orderNumber: `ORD-${Math.random()}`,
        publicToken: new Types.ObjectId().toString(),
        status,
        total,
        createdAt,
        items: [
          { productId, title: "Snapshot title", slug: "kurti", quantity: 2, lineTotal: total },
        ],
      });
    // 23:00 IST on 28 Oct is 17:30 UTC: must count on the 28th, not the 29th.
    await order(at("2026-10-28T17:30:00Z"), 200000);
    await order(at("2026-10-29T04:00:00Z"), 100000);
    await order(at("2026-10-29T05:00:00Z"), 999999, "CANCELLED");
    await order(at("2026-09-01T05:00:00Z"), 50000); // outside 7d

    const ev = (
      type: string,
      visitorId: string,
      sessionId: string,
      createdAt: Date,
      productId?: Types.ObjectId,
    ) => ({
      type,
      visitorId,
      sessionId,
      path: "/",
      device: "mobile",
      createdAt,
      productId: productId ?? null,
    });
    await AnalyticsEvent.insertMany([
      ev("page_view", "v1", "s1", at("2026-10-28T10:00:00Z")),
      ev("product_view", "v1", "s1", at("2026-10-28T10:01:00Z"), p._id),
      ev("add_to_cart", "v1", "s1", at("2026-10-28T10:02:00Z"), p._id),
      ev("checkout_started", "v1", "s1", at("2026-10-28T10:03:00Z")),
      ev("order_placed", "v1", "s1", at("2026-10-28T10:04:00Z")),
      ev("product_view", "v2", "s2", at("2026-10-29T03:00:00Z"), q._id),
      ev("product_view", "v2", "s2", at("2026-10-29T03:01:00Z"), q._id),
      ev("page_view", "v3", "s3", at("2026-10-29T04:00:00Z")),
    ]);
    return { p, q };
  }

  it("totals, funnel and top products for the range", async () => {
    const { p, q } = await seedReportData();
    const r = await getReports({ range: "7d", granularity: "day" }, NOW);

    expect(r.totals).toEqual({
      visitors: 3,
      sessions: 3,
      productViews: 3,
      orders: 2,
      revenue: 300000,
      conversionRate: 1 / 3,
    });
    expect(r.funnel.map((f) => f.sessions)).toEqual([3, 2, 1, 1, 1]);
    expect(r.topProducts.map((t) => [t.productId, t.views, t.unitsSold, t.revenue])).toEqual([
      [p.id, 1, 4, 300000],
      [q.id, 2, 0, 0],
    ]);
    // Current product title, not the order snapshot.
    expect(r.topProducts[0]!.title).toBe("Chikankari Kurti");
  });

  it("buckets by Indian calendar day and fills empty days", async () => {
    await seedReportData();
    const r = await getReports({ range: "7d", granularity: "day" }, NOW);
    expect(r.series).toHaveLength(7);
    expect(r.series[0]!.period).toBe("2026-10-23");
    expect(r.series.at(-2)).toMatchObject({
      period: "2026-10-28",
      label: "28 Oct",
      orders: 1,
      revenue: 200000,
      visitors: 1,
    });
    expect(r.series.at(-1)).toMatchObject({
      period: "2026-10-29",
      orders: 1,
      revenue: 100000,
      visitors: 2,
    });
    expect(r.series[0]).toMatchObject({ orders: 0, revenue: 0, visitors: 0 });
  });

  it("groups by Monday-start week and by month", async () => {
    await seedReportData();
    const weeks = await getReports({ range: "7d", granularity: "week" }, NOW);
    // 23 Oct 2026 is a Friday: its week starts Monday 19 Oct; 29 Oct falls in the week of 26 Oct.
    expect(weeks.series.map((s) => [s.period, s.orders])).toEqual([
      ["2026-10-19", 0],
      ["2026-10-26", 2],
    ]);
    // 90 days ending 29 Oct starts on 1 Aug.
    const months = await getReports({ range: "90d", granularity: "month" }, NOW);
    expect(months.series.map((s) => [s.label, s.orders, s.revenue])).toEqual([
      ["Aug 2026", 0, 0],
      ["Sep 2026", 1, 50000],
      ["Oct 2026", 2, 300000],
    ]);
  });
});

describe("settings", () => {
  it("reads and saves store settings for the owner", async () => {
    await StoreSettings.create({ storeName: "Boutique" });
    await createOwner();
    const admin = await loggedInAgent(app);
    const current = (await admin.get("/api/v1/admin/settings")).body;
    expect(current).toMatchObject({ storeName: "Boutique", currency: "INR", lowStockThreshold: 5 });

    const { updatedAt: _u, ...input } = current;
    const saved = await admin.put("/api/v1/admin/settings").send({
      ...input,
      storeName: "Asha Boutique",
      lowStockThreshold: 2,
      gstin: "09abcde1234f1z5",
    });
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({
      storeName: "Asha Boutique",
      lowStockThreshold: 2,
      gstin: "09ABCDE1234F1Z5",
    });
    expect((await request(app).get("/api/v1/public/store")).body.storeName).toBe("Asha Boutique");

    const bad = await admin.put("/api/v1/admin/settings").send({ ...input, accentColor: "pink" });
    expect(bad.status).toBe(400);
  });
});

import { ACCESS_COOKIE } from "@catafy/types";
import { SignJWT } from "jose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { signAccess } from "../src/lib/catalogue-access.js";
import { Catalogue, Product } from "../src/models/index.js";
import { clearDb, createOwner, loggedInAgent, startDb, testConfig } from "./helpers.js";

let stopDb: () => Promise<void>;
let app: ReturnType<typeof createApp>;
const SECRET = testConfig().jwtSecret;

beforeAll(async () => {
  stopDb = await startDb();
});
afterAll(() => stopDb());
beforeEach(async () => {
  await clearDb();
  app = createApp(testConfig()); // fresh rate limiters
});

let n = 0;
async function makeProduct(title: string) {
  n += 1;
  return Product.create({
    title,
    slug: `${title.toLowerCase().replace(/\s+/g, "-")}-${n}`,
    price: 250000,
    mrp: 300000,
    variants: [{ size: "M", colour: "Red", stock: 5 }],
  });
}

/** One open, one secret (private-only), one wholesale (price on request) product. */
async function setup() {
  const open = await makeProduct("Open Kurti");
  const secret = await makeProduct("Secret Saree");
  const wholesale = await makeProduct("Wholesale Set");
  const shared = await makeProduct("Shared Dupatta");
  await Catalogue.create({ name: "Summer", slug: "summer", productIds: [open._id, shared._id] });
  const vip = await Catalogue.create({
    name: "VIP",
    slug: "vip",
    isPrivate: true,
    passcode: "Diwali24",
    productIds: [secret._id, shared._id],
  });
  const trade = await Catalogue.create({
    name: "Trade",
    slug: "trade",
    hidePrices: true,
    passcode: "bulk-only",
    productIds: [wholesale._id],
  });
  return { open, secret, wholesale, shared, vip, trade };
}

/** A supertest agent that keeps cookies between requests, like a browser. */
function buyer() {
  const agent = request.agent(app);
  return {
    get: (url: string) => agent.get(`/api/v1/public${url}`),
    post: (url: string, body: object) => agent.post(`/api/v1/public${url}`).send(body),
    unlock: (slug: string, passcode: string) =>
      agent.post(`/api/v1/public/catalogues/${slug}/unlock`).send({ passcode }),
  };
}

const titles = (res: request.Response) =>
  (res.body.items as { title: string }[]).map((p) => p.title).sort();

describe("private catalogues without the passcode", () => {
  it("never return their products from any public endpoint", async () => {
    const { secret, open } = await setup();
    const b = buyer();

    expect(titles(await b.get("/products"))).toEqual([
      "Open Kurti",
      "Shared Dupatta",
      "Wholesale Set",
    ]);
    expect((await b.get("/products?q=saree")).body.total).toBe(0);
    expect((await b.get(`/products/${secret.slug}`)).status).toBe(404);
    expect((await b.get("/catalogues/vip")).body).toEqual({
      slug: "vip",
      name: "VIP",
      description: "",
      coverImage: null,
      productCount: 0,
      access: "locked",
      products: [],
    });
    const listed = (await b.get("/catalogues")).body.items.map((c: { slug: string }) => c.slug);
    expect(listed.sort()).toEqual(["summer", "trade"]);
    const sitemap = JSON.stringify((await b.get("/sitemap")).body);
    expect(sitemap).not.toContain(secret.slug);
    expect(sitemap).not.toContain("/c/vip");

    const quote = await b.post("/cart/quote", {
      items: [
        { productId: secret.id, variantId: secret.variants[0]!._id.toString(), quantity: 1 },
        { productId: open.id, variantId: open.variants[0]!._id.toString(), quantity: 1 },
      ],
    });
    expect(quote.body.lines[0]).toMatchObject({ issue: "unavailable", unitPrice: 0 });
    expect(quote.body.orderable).toBe(false);
  });

  it("still restrict products while the catalogue is inactive", async () => {
    const { secret, vip } = await setup();
    await Catalogue.updateOne({ _id: vip._id }, { isActive: false });
    expect((await buyer().get(`/products/${secret.slug}`)).status).toBe(404);
  });
});

describe("unlocking with a passcode", () => {
  it("rejects a wrong passcode and sets no cookie", async () => {
    await setup();
    const res = await buyer().unlock("vip", "nope");
    expect(res.status).toBe(403);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("rate-limits guessing", async () => {
    await setup();
    const b = buyer();
    for (let i = 0; i < 10; i++) expect((await b.unlock("vip", `guess-${i}`)).status).toBe(403);
    expect((await b.unlock("vip", "Diwali24")).status).toBe(429);
  });

  it("opens the catalogue and its products with an httpOnly cookie", async () => {
    const { secret } = await setup();
    const b = buyer();
    // Case and surrounding spaces don't matter: buyers type these on phones.
    const res = await b.unlock("vip", "  diwali24 ");
    expect(res.status).toBe(200);
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toContain(`${ACCESS_COOKIE}=`);
    expect(cookie).toContain("HttpOnly");

    const vip = await b.get("/catalogues/vip");
    expect(vip.body.access).toBe("open");
    expect(vip.body.products.map((p: { title: string }) => p.title)).toEqual([
      "Secret Saree",
      "Shared Dupatta",
    ]);
    expect(vip.headers["cache-control"]).toBe("private, no-store");

    const product = await b.get(`/products/${secret.slug}`);
    expect(product.status).toBe(200);
    expect(product.body.price).toBe(250000);

    const quote = await b.post("/cart/quote", {
      items: [{ productId: secret.id, variantId: secret.variants[0]!._id.toString(), quantity: 2 }],
    });
    expect(quote.body).toMatchObject({ orderable: true, total: 500000 });
  });

  it("only unlocks the catalogue the passcode belongs to", async () => {
    const { wholesale } = await setup();
    const b = buyer();
    await b.unlock("vip", "Diwali24");
    expect((await b.get("/catalogues/trade")).body.access).toBe("prices_locked");
    expect((await b.get(`/products/${wholesale.slug}`)).body.price).toBeNull();

    // A second unlock keeps the first.
    await b.unlock("trade", "bulk-only");
    expect((await b.get("/catalogues/vip")).body.access).toBe("open");
    expect((await b.get("/catalogues/trade")).body.access).toBe("open");
  });

  it("is revoked when the owner changes the passcode", async () => {
    const { secret, vip } = await setup();
    const b = buyer();
    await b.unlock("vip", "Diwali24");
    expect((await b.get(`/products/${secret.slug}`)).status).toBe(200);

    await Catalogue.updateOne({ _id: vip._id }, { passcode: "NewYear25" });
    expect((await b.get(`/products/${secret.slug}`)).status).toBe(404);
    expect((await b.get("/catalogues/vip")).body.access).toBe("locked");
  });

  it("ignores forged or foreign cookies", async () => {
    const { secret, vip } = await setup();
    const grant = { [vip.id]: "anything" };
    const wrongVersion = await signAccess(grant, SECRET);
    const wrongKey = await new SignJWT({ grants: grant })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("catafy-api")
      .setAudience("catalogue-access")
      .sign(new TextEncoder().encode("another-secret-another-secret-123"));

    for (const token of [wrongVersion, wrongKey, "not-a-jwt"]) {
      const res = await request(app)
        .get(`/api/v1/public/products/${secret.slug}`)
        .set("Cookie", `${ACCESS_COOKIE}=${token}`);
      expect(res.status).toBe(404);
    }
  });
});

describe("price on request", () => {
  it("shows the product but never its price, MRP or discount", async () => {
    const { wholesale } = await setup();
    const b = buyer();

    const card = (await b.get("/products")).body.items.find(
      (p: { title: string }) => p.title === "Wholesale Set",
    );
    expect(card).toMatchObject({
      price: null,
      mrp: null,
      discountPercent: null,
      priceOnRequest: true,
    });

    const product = await b.get(`/products/${wholesale.slug}`);
    expect(product.body).toMatchObject({
      price: null,
      priceOnRequest: true,
      unlockVia: { slug: "trade", name: "Trade" },
    });
    expect(JSON.stringify(product.body)).not.toContain("250000");

    const trade = await b.get("/catalogues/trade");
    expect(trade.body.access).toBe("prices_locked");
    expect(trade.body.products[0].price).toBeNull();

    const quote = await b.post("/cart/quote", {
      items: [
        { productId: wholesale.id, variantId: wholesale.variants[0]!._id.toString(), quantity: 1 },
      ],
    });
    expect(quote.body.lines[0]).toMatchObject({ issue: "unavailable", unitPrice: 0 });
    expect(quote.body.total).toBe(0);
  });

  it("reveals prices and allows ordering after unlocking", async () => {
    const { wholesale } = await setup();
    const b = buyer();
    await b.unlock("trade", "bulk-only");
    expect((await b.get(`/products/${wholesale.slug}`)).body).toMatchObject({
      price: 250000,
      priceOnRequest: false,
    });
    const order = await b.post("/orders", {
      customer: {
        name: "Asha Rao",
        phone: "9876543210",
        line1: "4 Park Street",
        city: "Kolkata",
        pincode: "700016",
      },
      items: [
        { productId: wholesale.id, variantId: wholesale.variants[0]!._id.toString(), quantity: 1 },
      ],
    });
    expect(order.status).toBe(201);
  });

  it("keeps the price public when the product is also in an open catalogue", async () => {
    const { shared } = await setup();
    // Shared Dupatta is in Summer (open) and VIP (private): the open catalogue wins.
    const res = await buyer().get(`/products/${shared.slug}`);
    expect(res.body).toMatchObject({ price: 250000, priceOnRequest: false });
  });
});

describe("admin catalogue passcodes", () => {
  it("requires a passcode to restrict a catalogue and keeps it when left blank", async () => {
    await createOwner();
    const admin = await loggedInAgent(app);
    const base = { name: "Bridal", productIds: [] };

    const missing = await admin.post("/api/v1/admin/catalogues").send({ ...base, isPrivate: true });
    expect(missing.status).toBe(400);
    expect(missing.body.error.details).toEqual({ field: "passcode" });

    const created = await admin
      .post("/api/v1/admin/catalogues")
      .send({ ...base, isPrivate: true, passcode: "Bride2026" });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ isPrivate: true, passcode: "Bride2026" });

    const updated = await admin
      .put(`/api/v1/admin/catalogues/${created.body.id}`)
      .send({ ...base, isPrivate: true, passcode: "" });
    expect(updated.body.passcode).toBe("Bride2026");

    expect((await buyer().get("/catalogues/bridal")).body).not.toHaveProperty("passcode");
  });
});

import {
  ACCESS_COOKIE,
  cartQuoteInputSchema,
  catalogueUnlockInputSchema,
  checkoutInputSchema,
  SESSION_COOKIE,
  trackEventInputSchema,
  publicProductListQuerySchema,
  slugSchema,
} from "@catafy/types";
import { Router, type Request } from "express";
import type { AppConfig } from "../config.js";
import { ACCESS_TTL_SECONDS, signAccess } from "../lib/catalogue-access.js";
import { AppError } from "../lib/errors.js";
import { verifySession } from "../lib/session.js";
import { parse } from "../lib/validate.js";
import { catalogueAccess } from "../middleware/catalogue-access.js";
import { createRateLimit } from "../middleware/rate-limit.js";
import { resolveRestrictions, unlockCatalogue } from "../services/access.service.js";
import { recordEvent } from "../services/analytics.service.js";
import * as orders from "../services/order.service.js";
import * as storefront from "../services/storefront.service.js";

function slugParam(value: unknown, what: string): string {
  const result = slugSchema.safeParse(value);
  if (!result.success) throw AppError.notFound(`${what} not found`);
  return result.data;
}

function restrictions(req: Request) {
  if (!req.restrictions) throw new Error("catalogueAccess middleware not mounted");
  return req.restrictions;
}

/**
 * Storefront endpoints. No login; Next.js caches the responses of anonymous requests. Buyers who
 * unlocked a catalogue carry a signed cookie, and their responses are never cached.
 */
export function publicRouter({
  revalidate,
  jwtSecret,
  isProd,
}: Pick<AppConfig, "revalidate" | "jwtSecret" | "isProd">): Router {
  const router = Router();

  // Analytics events don't depend on catalogue access, so they skip that lookup.
  router.post("/events", createRateLimit({ windowMs: 60 * 1000, limit: 120 }), async (req, res) => {
    const event = parse(trackEventInputSchema, req.body);
    // The owner checking their own store isn't a visitor.
    const owner = await verifySession(
      req.cookies?.[SESSION_COOKIE] as string | undefined,
      jwtSecret,
    );
    if (!owner) await recordEvent(event, req.get("user-agent") ?? "");
    res.status(204).end();
  });

  router.use(catalogueAccess(jwtSecret));

  router.get("/store", async (_req, res) => {
    res.json(await storefront.getStore());
  });

  router.get("/categories", async (req, res) => {
    res.json({ items: await storefront.listCategories(restrictions(req)) });
  });

  router.get("/products", async (req, res) => {
    const query = parse(publicProductListQuerySchema, req.query);
    res.json(await storefront.listProducts(query, restrictions(req)));
  });

  router.get("/products/:slug", async (req, res) => {
    res.json(await storefront.getProduct(slugParam(req.params.slug, "Product"), restrictions(req)));
  });

  router.get("/catalogues", async (req, res) => {
    res.json({ items: await storefront.listCatalogues(restrictions(req)) });
  });

  router.get("/catalogues/:slug", async (req, res) => {
    const slug = slugParam(req.params.slug, "Catalogue");
    res.json(await storefront.getCatalogue(slug, restrictions(req)));
  });

  router.post(
    "/catalogues/:slug/unlock",
    createRateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }),
    async (req, res) => {
      const slug = slugParam(req.params.slug, "Catalogue");
      const { passcode } = parse(catalogueUnlockInputSchema, req.body);
      const grants = await unlockCatalogue(slug, passcode, req.accessGrants ?? {});
      res.cookie(ACCESS_COOKIE, await signAccess(grants, jwtSecret), {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        maxAge: ACCESS_TTL_SECONDS * 1000,
      });
      res.json({ ok: true });
    },
  );

  router.get("/sitemap", async (_req, res) => {
    // Built as an anonymous visitor whatever cookie the caller has.
    res.json({ items: await storefront.sitemap(await resolveRestrictions({})) });
  });

  // ---------- Cart & orders (called from the browser via the Next.js rewrite) ----------

  router.post(
    "/cart/quote",
    createRateLimit({ windowMs: 60 * 1000, limit: 60 }),
    async (req, res) => {
      const { items } = parse(cartQuoteInputSchema, req.body);
      res.json(await orders.quoteCart(items, restrictions(req)));
    },
  );

  router.post(
    "/orders",
    createRateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }),
    async (req, res) => {
      const placed = await orders.placeOrder(
        parse(checkoutInputSchema, req.body),
        restrictions(req),
      );
      // Stock changed, so the storefront's cached "in stock"/"only N left" must refresh.
      revalidate();
      res.status(201).json(placed);
    },
  );

  router.get("/orders/:token", async (req, res) => {
    const token = req.params.token ?? "";
    if (!/^[A-Za-z0-9_-]{24}$/.test(token)) throw AppError.notFound("Order not found");
    res.set("Cache-Control", "private, no-store");
    res.json(await orders.getOrderConfirmation(token));
  });

  return router;
}

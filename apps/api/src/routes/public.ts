import {
  cartQuoteInputSchema,
  checkoutInputSchema,
  publicProductListQuerySchema,
  slugSchema,
} from "@catafy/types";
import { Router } from "express";
import type { AppConfig } from "../config.js";
import { AppError } from "../lib/errors.js";
import { parse } from "../lib/validate.js";
import { createRateLimit } from "../middleware/rate-limit.js";
import * as orders from "../services/order.service.js";
import * as storefront from "../services/storefront.service.js";

function slugParam(value: string | undefined, what: string): string {
  const result = slugSchema.safeParse(value);
  if (!result.success) throw AppError.notFound(`${what} not found`);
  return result.data;
}

/** Read-only storefront endpoints. No auth; Next.js caches the responses. */
export function publicRouter({ revalidate }: Pick<AppConfig, "revalidate">): Router {
  const router = Router();

  router.get("/store", async (_req, res) => {
    res.json(await storefront.getStore());
  });

  router.get("/categories", async (_req, res) => {
    res.json({ items: await storefront.listCategories() });
  });

  router.get("/products", async (req, res) => {
    res.json(await storefront.listProducts(parse(publicProductListQuerySchema, req.query)));
  });

  router.get("/products/:slug", async (req, res) => {
    res.json(await storefront.getProduct(slugParam(req.params.slug, "Product")));
  });

  router.get("/catalogues", async (_req, res) => {
    res.json({ items: await storefront.listCatalogues() });
  });

  router.get("/catalogues/:slug", async (req, res) => {
    res.json(await storefront.getCatalogue(slugParam(req.params.slug, "Catalogue")));
  });

  router.get("/sitemap", async (_req, res) => {
    res.json({ items: await storefront.sitemap() });
  });

  // ---------- Cart & orders (called from the browser via the Next.js rewrite) ----------

  router.post(
    "/cart/quote",
    createRateLimit({ windowMs: 60 * 1000, limit: 60 }),
    async (req, res) => {
      res.json(await orders.quoteCart(parse(cartQuoteInputSchema, req.body).items));
    },
  );

  router.post(
    "/orders",
    createRateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }),
    async (req, res) => {
      const placed = await orders.placeOrder(parse(checkoutInputSchema, req.body));
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

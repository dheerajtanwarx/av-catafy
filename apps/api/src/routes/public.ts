import { publicProductListQuerySchema, slugSchema } from "@catafy/types";
import { Router } from "express";
import { AppError } from "../lib/errors.js";
import { parse } from "../lib/validate.js";
import * as storefront from "../services/storefront.service.js";

function slugParam(value: string | undefined, what: string): string {
  const result = slugSchema.safeParse(value);
  if (!result.success) throw AppError.notFound(`${what} not found`);
  return result.data;
}

/** Read-only storefront endpoints. No auth; Next.js caches the responses. */
export function publicRouter(): Router {
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

  return router;
}

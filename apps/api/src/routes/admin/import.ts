import { importInputSchema } from "@catafy/types";
import { Router } from "express";
import type { Revalidate } from "../../lib/revalidate.js";
import { parse } from "../../lib/validate.js";
import { importProducts } from "../../services/import.service.js";

export function importRouter(revalidate: Revalidate): Router {
  const router = Router();

  /** Preview (`commit: false`) and import (`commit: true`) share one validation path. */
  router.post("/products", async (req, res) => {
    const report = await importProducts(parse(importInputSchema, req.body));
    // A preview changes nothing, so only a real import refreshes the storefront.
    if (report.summary.created > 0) revalidate();
    res.json(report);
  });

  return router;
}

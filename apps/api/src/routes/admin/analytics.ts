import { reportsQuerySchema } from "@catafy/types";
import { Router } from "express";
import { parse } from "../../lib/validate.js";
import { getLiveSnapshot, getReports } from "../../services/analytics.service.js";

export function analyticsRouter(): Router {
  const router = Router();

  /** Polled every 10 seconds by the Live page (decision 6). */
  router.get("/live", async (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(await getLiveSnapshot());
  });

  router.get("/reports", async (req, res) => {
    res.json(await getReports(parse(reportsQuerySchema, req.query)));
  });

  return router;
}

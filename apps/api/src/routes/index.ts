import { Router } from "express";
import type { AppConfig } from "../config.js";
import { adminRouter } from "./admin/index.js";
import { healthRouter } from "./health.js";

export function v1Router(config: AppConfig): Router {
  const router = Router();
  router.use("/health", healthRouter);
  // Storefront endpoints (no auth) arrive in Phase 3.
  router.use("/public", Router());
  router.use("/admin", adminRouter(config));
  return router;
}

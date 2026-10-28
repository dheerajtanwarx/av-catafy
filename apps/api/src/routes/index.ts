import { Router } from "express";
import type { AppConfig } from "../config.js";
import { adminRouter } from "./admin/index.js";
import { healthRouter } from "./health.js";
import { publicRouter } from "./public.js";

export function v1Router(config: AppConfig): Router {
  const router = Router();
  router.use("/health", healthRouter);
  router.use("/public", publicRouter());
  router.use("/admin", adminRouter(config));
  return router;
}

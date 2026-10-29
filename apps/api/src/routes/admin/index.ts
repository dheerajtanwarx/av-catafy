import { Router } from "express";
import type { AppConfig } from "../../config.js";
import { requireAuth, requireSameOrigin } from "../../middleware/auth.js";
import { revalidateOnWrite } from "../../middleware/revalidate-on-write.js";
import { analyticsRouter } from "./analytics.js";
import { authRouter } from "./auth.js";
import { cataloguesRouter } from "./catalogues.js";
import { categoriesRouter } from "./categories.js";
import { customersRouter } from "./customers.js";
import { importRouter } from "./import.js";
import { ordersRouter } from "./orders.js";
import { productsRouter } from "./products.js";
import { settingsRouter } from "./settings.js";
import { uploadsRouter } from "./uploads.js";

export function adminRouter(config: AppConfig): Router {
  const router = Router();

  router.use(requireSameOrigin(config.webOrigin));
  router.use("/auth", authRouter(config));

  // Everything below requires the owner session.
  router.use(requireAuth(config.jwtSecret));
  router.use("/uploads", uploadsRouter(config));
  // Order edits don't touch the storefront, except cancellations (handled in the router).
  router.use("/orders", ordersRouter(config.revalidate));
  router.use("/customers", customersRouter());
  router.use("/import", importRouter(config.revalidate));
  router.use("/analytics", analyticsRouter());

  // Writes below change what the storefront shows.
  router.use(revalidateOnWrite(config.revalidate));
  router.use("/categories", categoriesRouter());
  router.use("/products", productsRouter());
  router.use("/catalogues", cataloguesRouter());
  router.use("/settings", settingsRouter());

  return router;
}

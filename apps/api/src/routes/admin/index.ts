import { Router } from "express";
import type { AppConfig } from "../../config.js";
import { requireAuth, requireSameOrigin } from "../../middleware/auth.js";
import { revalidateOnWrite } from "../../middleware/revalidate-on-write.js";
import { authRouter } from "./auth.js";
import { cataloguesRouter } from "./catalogues.js";
import { categoriesRouter } from "./categories.js";
import { productsRouter } from "./products.js";
import { uploadsRouter } from "./uploads.js";

export function adminRouter(config: AppConfig): Router {
  const router = Router();

  router.use(requireSameOrigin(config.webOrigin));
  router.use("/auth", authRouter(config));

  // Everything below requires the owner session.
  router.use(requireAuth(config.jwtSecret));
  router.use("/uploads", uploadsRouter(config));

  // Writes below change what the storefront shows.
  router.use(revalidateOnWrite(config.revalidate));
  router.use("/categories", categoriesRouter());
  router.use("/products", productsRouter());
  router.use("/catalogues", cataloguesRouter());

  return router;
}

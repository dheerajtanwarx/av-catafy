import { presignUploadInputSchema } from "@catafy/types";
import { Router } from "express";
import type { AppConfig } from "../../config.js";
import { parse } from "../../lib/validate.js";
import { createRateLimit } from "../../middleware/rate-limit.js";

export function uploadsRouter({ storage }: AppConfig): Router {
  const router = Router();

  router.post("/presign", createRateLimit({ windowMs: 60 * 1000, limit: 60 }), async (req, res) => {
    res.json(await storage.presignUpload(parse(presignUploadInputSchema, req.body)));
  });

  return router;
}

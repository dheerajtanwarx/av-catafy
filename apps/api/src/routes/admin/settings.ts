import { storeSettingsInputSchema } from "@catafy/types";
import { Router } from "express";
import { parse } from "../../lib/validate.js";
import { getSettings, updateSettings } from "../../services/settings.service.js";

export function settingsRouter(): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    res.json(await getSettings());
  });

  router.put("/", async (req, res) => {
    res.json(await updateSettings(parse(storeSettingsInputSchema, req.body)));
  });

  return router;
}

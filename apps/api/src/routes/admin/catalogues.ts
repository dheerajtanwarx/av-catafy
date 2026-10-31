import { catalogueInputSchema } from "@catafy/types";
import { Router } from "express";
import { assertObjectId, parse } from "../../lib/validate.js";
import * as catalogues from "../../services/catalogue.service.js";

export function cataloguesRouter(): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    res.json({ items: await catalogues.listCatalogues() });
  });

  router.get("/:id", async (req, res) => {
    res.json(await catalogues.getCatalogue(assertObjectId(req.params.id, "Catalogue")));
  });

  router.post("/", async (req, res) => {
    res.status(201).json(await catalogues.createCatalogue(parse(catalogueInputSchema, req.body)));
  });

  router.put("/:id", async (req, res) => {
    const id = assertObjectId(req.params.id, "Catalogue");
    res.json(await catalogues.updateCatalogue(id, parse(catalogueInputSchema, req.body)));
  });

  router.delete("/:id", async (req, res) => {
    await catalogues.deleteCatalogue(assertObjectId(req.params.id, "Catalogue"));
    res.status(204).end();
  });

  return router;
}

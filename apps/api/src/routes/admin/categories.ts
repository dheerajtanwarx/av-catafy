import { categoryInputSchema } from "@catafy/types";
import { Router } from "express";
import { assertObjectId, parse } from "../../lib/validate.js";
import * as categories from "../../services/category.service.js";

export function categoriesRouter(): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    res.json({ items: await categories.listCategories() });
  });

  router.post("/", async (req, res) => {
    res.status(201).json(await categories.createCategory(parse(categoryInputSchema, req.body)));
  });

  router.put("/:id", async (req, res) => {
    const id = assertObjectId(req.params.id, "Category");
    res.json(await categories.updateCategory(id, parse(categoryInputSchema, req.body)));
  });

  router.delete("/:id", async (req, res) => {
    await categories.deleteCategory(assertObjectId(req.params.id, "Category"));
    res.status(204).end();
  });

  return router;
}

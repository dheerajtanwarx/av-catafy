import { adminProductListQuerySchema, productInputSchema } from "@catafy/types";
import { Router } from "express";
import { assertObjectId, parse } from "../../lib/validate.js";
import * as products from "../../services/product.service.js";

export function productsRouter(): Router {
  const router = Router();

  router.get("/", async (req, res) => {
    res.json(await products.listProducts(parse(adminProductListQuerySchema, req.query)));
  });

  router.get("/:id", async (req, res) => {
    res.json(await products.getProduct(assertObjectId(req.params.id, "Product")));
  });

  router.post("/", async (req, res) => {
    res.status(201).json(await products.createProduct(parse(productInputSchema, req.body)));
  });

  router.put("/:id", async (req, res) => {
    const id = assertObjectId(req.params.id, "Product");
    res.json(await products.updateProduct(id, parse(productInputSchema, req.body)));
  });

  router.delete("/:id", async (req, res) => {
    await products.deleteProduct(assertObjectId(req.params.id, "Product"));
    res.status(204).end();
  });

  return router;
}

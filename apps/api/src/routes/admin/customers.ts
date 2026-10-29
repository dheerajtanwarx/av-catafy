import { adminCustomerListQuerySchema, customerUpdateInputSchema } from "@catafy/types";
import { Router } from "express";
import { assertObjectId, parse } from "../../lib/validate.js";
import * as customers from "../../services/customer.service.js";

export function customersRouter(): Router {
  const router = Router();

  router.get("/", async (req, res) => {
    res.json(await customers.listCustomers(parse(adminCustomerListQuerySchema, req.query)));
  });

  router.get("/:id", async (req, res) => {
    res.json(await customers.getCustomer(assertObjectId(req.params.id, "Customer")));
  });

  router.patch("/:id", async (req, res) => {
    const id = assertObjectId(req.params.id, "Customer");
    res.json(await customers.updateCustomer(id, parse(customerUpdateInputSchema, req.body)));
  });

  return router;
}

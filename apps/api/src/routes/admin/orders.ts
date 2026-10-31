import {
  adminOrderListQuerySchema,
  orderStatusInputSchema,
  orderUpdateInputSchema,
} from "@catafy/types";
import { Router } from "express";
import type { Revalidate } from "../../lib/revalidate.js";
import { assertObjectId, parse } from "../../lib/validate.js";
import * as orders from "../../services/admin-order.service.js";
import { getInvoiceStoreInfo } from "../../services/settings.service.js";

export function ordersRouter(revalidate: Revalidate): Router {
  const router = Router();

  router.get("/", async (req, res) => {
    res.json(await orders.listOrders(parse(adminOrderListQuerySchema, req.query)));
  });

  router.get("/:id", async (req, res) => {
    res.json(await orders.getOrder(assertObjectId(req.params.id, "Order")));
  });

  /** Order plus the store header, for the printable invoice / packing slip. */
  router.get("/:id/print", async (req, res) => {
    const id = assertObjectId(req.params.id, "Order");
    const [order, store] = await Promise.all([orders.getOrder(id), getInvoiceStoreInfo()]);
    res.json({ order, store });
  });

  router.post("/:id/status", async (req, res) => {
    const id = assertObjectId(req.params.id, "Order");
    const { status } = parse(orderStatusInputSchema, req.body);
    const { order, stockRestored } = await orders.changeStatus(id, status);
    // Only a cancellation changes what the storefront shows (stock comes back).
    if (stockRestored) revalidate();
    res.json(order);
  });

  router.patch("/:id", async (req, res) => {
    const id = assertObjectId(req.params.id, "Order");
    res.json(await orders.updateOrder(id, parse(orderUpdateInputSchema, req.body)));
  });

  return router;
}

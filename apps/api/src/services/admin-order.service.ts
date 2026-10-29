import {
  canTransition,
  nextOrderStatuses,
  paymentStatusFor,
  type AdminOrderDetail,
  type AdminOrderSummary,
  type adminOrderListQuerySchema,
  type OrderStatus,
  type OrderUpdateInput,
  type Paginated,
} from "@catafy/types";
import mongoose, { Types, type FilterQuery } from "mongoose";
import type { z } from "zod";
import { AppError } from "../lib/errors.js";
import { escapeRegex, phoneSearchDigits } from "../lib/search.js";
import { Order, Product, type OrderDoc } from "../models/index.js";

type ListQuery = z.output<typeof adminOrderListQuerySchema>;
type OrderLean = OrderDoc & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };

/** Calendar-day filters use the store's time zone (India). */
const STORE_UTC_OFFSET = "+05:30";

function toSummary(o: OrderLean): AdminOrderSummary {
  return {
    id: o._id.toString(),
    orderNumber: o.orderNumber,
    createdAt: o.createdAt.toISOString(),
    status: o.status,
    paymentStatus: o.paymentStatus,
    customerId: o.customerId.toString(),
    customerName: o.shippingAddress.name,
    phone: o.shippingAddress.phone,
    city: o.shippingAddress.city,
    itemCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
    total: o.total,
    amountReceived: o.amountReceived ?? 0,
  };
}

function toDetail(o: OrderLean): AdminOrderDetail {
  const a = o.shippingAddress;
  return {
    ...toSummary(o),
    shippingAddress: {
      name: a.name,
      phone: a.phone,
      line1: a.line1,
      city: a.city,
      state: a.state,
      pincode: a.pincode,
    },
    note: o.note,
    items: o.items.map((i) => ({
      productId: i.productId.toString(),
      variantId: i.variantId.toString(),
      title: i.title,
      slug: i.slug,
      imageKey: i.imageKey ?? null,
      size: i.size,
      colour: i.colour,
      sku: i.sku ?? null,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      lineTotal: i.lineTotal,
    })),
    subtotal: o.subtotal,
    statusHistory: o.statusHistory.map((h) => ({ status: h.status, at: h.at.toISOString() })),
    nextStatuses: nextOrderStatuses(o.status),
    paymentNotes: o.paymentNotes,
    courier: o.courier,
    trackingNumber: o.trackingNumber,
    internalNotes: o.internalNotes,
    stockRestoredAt: o.stockRestoredAt ? o.stockRestoredAt.toISOString() : null,
    updatedAt: o.updatedAt.toISOString(),
  };
}

export async function listOrders(query: ListQuery): Promise<Paginated<AdminOrderSummary>> {
  const filter: FilterQuery<OrderDoc> = {};
  if (query.status) filter.status = query.status;
  if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
  if (query.customerId) filter.customerId = new Types.ObjectId(query.customerId);
  if (query.from || query.to) {
    const createdAt: { $gte?: Date; $lt?: Date } = {};
    if (query.from) createdAt.$gte = new Date(`${query.from}T00:00:00${STORE_UTC_OFFSET}`);
    if (query.to) {
      const end = new Date(`${query.to}T00:00:00${STORE_UTC_OFFSET}`);
      end.setUTCDate(end.getUTCDate() + 1);
      createdAt.$lt = end;
    }
    filter.createdAt = createdAt;
  }
  if (query.q) {
    const re = new RegExp(escapeRegex(query.q), "i");
    const or: FilterQuery<OrderDoc>[] = [{ orderNumber: re }, { "shippingAddress.name": re }];
    const digits = phoneSearchDigits(query.q);
    if (digits) or.push({ "shippingAddress.phone": new RegExp(digits) });
    filter.$or = or;
  }

  const [items, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean<OrderLean[]>(),
    Order.countDocuments(filter),
  ]);
  return {
    items: items.map(toSummary),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

export async function getOrder(id: string): Promise<AdminOrderDetail> {
  const order = await Order.findById(id).lean<OrderLean>();
  if (!order) throw AppError.notFound("Order not found");
  return toDetail(order);
}

/**
 * Moves an order along the workflow. Cancelling returns every line's stock in the same
 * transaction. The update is conditional on the status we read, so two tabs cancelling at once
 * can't both restore stock; `stockRestoredAt` is a second guard.
 *
 * Returns whether stock changed, so the caller can refresh the storefront.
 */
export async function changeStatus(
  id: string,
  to: OrderStatus,
): Promise<{ order: AdminOrderDetail; stockRestored: boolean }> {
  const session = await mongoose.startSession();
  try {
    let stockRestored = false;
    await session.withTransaction(async () => {
      stockRestored = false;
      const order = await Order.findById(id).session(session).lean<OrderLean>();
      if (!order) throw AppError.notFound("Order not found");
      if (!canTransition(order.status, to)) {
        throw AppError.conflict(`An order that is ${order.status} can't be moved to ${to}`, {
          status: order.status,
          allowed: nextOrderStatuses(order.status),
        });
      }

      const now = new Date();
      const restore = to === "CANCELLED" && !order.stockRestoredAt;
      const { modifiedCount } = await Order.updateOne(
        { _id: order._id, status: order.status },
        {
          $set: { status: to, ...(restore ? { stockRestoredAt: now } : {}) },
          $push: { statusHistory: { status: to, at: now } },
        },
        { session },
      );
      if (modifiedCount !== 1) {
        throw AppError.conflict("This order was just updated elsewhere. Reload and try again.");
      }

      if (restore) {
        // Soft-deleted products get their stock back too (harmless); removed variants are skipped.
        for (const item of order.items) {
          await Product.updateOne(
            { _id: item.productId, "variants._id": item.variantId },
            { $inc: { "variants.$.stock": item.quantity } },
            { session },
          );
        }
        stockRestored = true;
      }
    });
    return { order: await getOrder(id), stockRestored };
  } finally {
    await session.endSession();
  }
}

export async function updateOrder(id: string, input: OrderUpdateInput): Promise<AdminOrderDetail> {
  const order = await Order.findById(id);
  if (!order) throw AppError.notFound("Order not found");
  order.set(input);
  order.paymentStatus = paymentStatusFor(order.amountReceived ?? 0, order.total);
  await order.save();
  return getOrder(id);
}

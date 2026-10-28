import { randomBytes } from "node:crypto";
import {
  lineTotal,
  mergeCartItems,
  orderTotals,
  type CartItemInput,
  type CartQuote,
  type CheckoutInputParsed,
  type OrderConfirmation,
  type QuoteLine,
} from "@catafy/types";
import type { Types } from "mongoose";
import mongoose, { type ClientSession } from "mongoose";
import { nextOrderNumber } from "../lib/counters.js";
import { AppError } from "../lib/errors.js";
import {
  Customer,
  Order,
  Product,
  type OrderDoc,
  type ProductDoc,
  type VariantDoc,
} from "../models/index.js";
import { VISIBLE_PRODUCT } from "./storefront.service.js";

type OrderLean = OrderDoc & { createdAt: Date };
type ProductLean = ProductDoc & {
  _id: Types.ObjectId;
  variants: (VariantDoc & { _id: Types.ObjectId })[];
};

/**
 * Prices every line from the database (client prices are never used) and flags anything that
 * can't be ordered: hidden/deleted products, missing variants, stock and minimum order quantity.
 */
export async function quoteCart(
  items: CartItemInput[],
  session?: ClientSession,
): Promise<CartQuote> {
  const merged = mergeCartItems(items);
  const products = await Product.find({
    ...VISIBLE_PRODUCT,
    _id: { $in: [...new Set(merged.map((i) => i.productId))] },
  })
    .session(session ?? null)
    .lean<ProductLean[]>();
  const byId = new Map(products.map((p) => [p._id.toString(), p]));

  const lines: QuoteLine[] = merged.map((item) => {
    const product = byId.get(item.productId);
    const variant = product?.variants.find((v) => v._id.toString() === item.variantId);
    if (!product || !variant) {
      return {
        ...item,
        title: product?.title ?? "Unavailable item",
        slug: product?.slug ?? "",
        image: null,
        size: variant?.size ?? "",
        colour: variant?.colour ?? "",
        unitPrice: 0,
        lineTotal: 0,
        available: 0,
        moq: 1,
        packSize: null,
        issue: "unavailable",
      };
    }
    const cover = product.images[0];
    const issue =
      variant.stock === 0
        ? "out_of_stock"
        : variant.stock < item.quantity
          ? "insufficient_stock"
          : null;
    return {
      ...item,
      title: product.title,
      slug: product.slug,
      image: cover
        ? { key: cover.key, width: cover.width, height: cover.height, alt: cover.alt }
        : null,
      size: variant.size,
      colour: variant.colour,
      unitPrice: product.price,
      lineTotal: lineTotal({ unitPrice: product.price, quantity: item.quantity }),
      available: variant.stock,
      moq: product.moq,
      packSize: product.packSize ?? null,
      issue,
    };
  });

  // Minimum order quantity applies to the product as a whole (all its sizes/colours together).
  const qtyByProduct = new Map<string, number>();
  for (const l of lines)
    qtyByProduct.set(l.productId, (qtyByProduct.get(l.productId) ?? 0) + l.quantity);
  for (const l of lines) {
    if (!l.issue && (qtyByProduct.get(l.productId) ?? 0) < l.moq) l.issue = "below_moq";
  }

  const priced = lines.filter((l) => l.issue !== "unavailable");
  const { subtotal, total } = orderTotals(
    priced.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity })),
  );
  return { lines, subtotal, total, orderable: lines.every((l) => !l.issue) };
}

function cartChanged(lines: QuoteLine[]): AppError {
  return new AppError(
    409,
    "OUT_OF_STOCK",
    "Some items in your bag have changed. Please review and try again.",
    {
      lines: lines.map((l) => ({
        variantId: l.variantId,
        issue: l.issue,
        available: l.available,
        moq: l.moq,
      })),
    },
  );
}

/**
 * Creates the order and reserves stock in one transaction, so two buyers can never both get the
 * last piece: each line is decremented with a conditional update (`stock >= qty`), and if any line
 * fails the whole order (stock, customer, counter) rolls back.
 */
export async function placeOrder(
  input: CheckoutInputParsed,
): Promise<{ orderNumber: string; token: string }> {
  const session = await mongoose.startSession();
  try {
    let result: { orderNumber: string; token: string } | undefined;
    // withTransaction retries on transient write conflicts, so this callback must be re-runnable.
    await session.withTransaction(async () => {
      const quote = await quoteCart(input.items, session);
      const blocked = quote.lines.filter((l) => l.issue);
      if (blocked.length) throw cartChanged(blocked);

      for (const line of quote.lines) {
        const { modifiedCount } = await Product.updateOne(
          {
            ...VISIBLE_PRODUCT,
            _id: line.productId,
            variants: { $elemMatch: { _id: line.variantId, stock: { $gte: line.quantity } } },
          },
          { $inc: { "variants.$.stock": -line.quantity } },
          { session },
        );
        if (modifiedCount !== 1) throw cartChanged([{ ...line, issue: "insufficient_stock" }]);
      }

      const { customer: c, note } = input;
      const address = {
        name: c.name,
        phone: c.phone,
        line1: c.line1,
        city: c.city,
        state: c.state,
        pincode: c.pincode,
      };
      const customer = await Customer.findOneAndUpdate(
        { phone: c.phone },
        { $set: { name: c.name, lastAddress: address } },
        { upsert: true, new: true, session },
      );

      const orderNumber = await nextOrderNumber(session);
      const token = randomBytes(18).toString("base64url");
      await Order.create(
        [
          {
            orderNumber,
            publicToken: token,
            customerId: customer._id,
            shippingAddress: address,
            note,
            items: quote.lines.map((l) => ({
              productId: l.productId,
              variantId: l.variantId,
              title: l.title,
              slug: l.slug,
              imageKey: l.image?.key ?? null,
              size: l.size,
              colour: l.colour,
              unitPrice: l.unitPrice,
              quantity: l.quantity,
              lineTotal: l.lineTotal,
            })),
            subtotal: quote.subtotal,
            total: quote.total,
            status: "PENDING",
            paymentStatus: "UNPAID",
            statusHistory: [{ status: "PENDING", at: new Date() }],
          },
        ],
        { session },
      );
      result = { orderNumber, token };
    });
    if (!result) throw new Error("Order transaction finished without a result");
    return result;
  } finally {
    await session.endSession();
  }
}

export async function getOrderConfirmation(token: string): Promise<OrderConfirmation> {
  const o = await Order.findOne({ publicToken: token }).lean<OrderLean>();
  if (!o) throw AppError.notFound("Order not found");
  const a = o.shippingAddress;
  return {
    orderNumber: o.orderNumber,
    token: o.publicToken,
    createdAt: o.createdAt.toISOString(),
    status: o.status,
    paymentStatus: o.paymentStatus,
    customer: {
      name: a.name,
      phone: a.phone,
      line1: a.line1,
      city: a.city,
      state: a.state,
      pincode: a.pincode,
    },
    note: o.note,
    items: o.items.map((i) => ({
      title: i.title,
      slug: i.slug,
      imageKey: i.imageKey ?? null,
      size: i.size,
      colour: i.colour,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      lineTotal: i.lineTotal,
    })),
    subtotal: o.subtotal,
    total: o.total,
  };
}

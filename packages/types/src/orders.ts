import { z } from "zod";
import { objectIdSchema, phoneSchema, pincodeSchema } from "./common.js";
import type { OrderStatus, PaymentStatus } from "./enums.js";
import type { ImageInput } from "./uploads.js";

export const MAX_LINE_QUANTITY = 999;
export const MAX_CART_LINES = 50;

export const cartItemSchema = z.object({
  productId: objectIdSchema,
  variantId: objectIdSchema,
  quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
});
export type CartItemInput = z.infer<typeof cartItemSchema>;

const cartItemsSchema = z
  .array(cartItemSchema)
  .min(1, "Your bag is empty")
  .max(MAX_CART_LINES, `At most ${MAX_CART_LINES} different items per order`);

export const cartQuoteInputSchema = z.object({ items: cartItemsSchema });

export const checkoutCustomerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  phone: phoneSchema,
  line1: z.string().trim().min(5, "Enter your full address").max(300),
  city: z.string().trim().min(2, "Enter your city").max(80),
  state: z.string().trim().max(80).default(""),
  pincode: pincodeSchema,
});
export type CheckoutCustomer = z.input<typeof checkoutCustomerSchema>;

export const checkoutInputSchema = z.object({
  customer: checkoutCustomerSchema,
  note: z.string().trim().max(500).default(""),
  items: cartItemsSchema,
});
export type CheckoutInput = z.input<typeof checkoutInputSchema>;
export type CheckoutInputParsed = z.output<typeof checkoutInputSchema>;

/** Why a cart line can't be ordered as-is. */
export type QuoteLineIssue = "unavailable" | "out_of_stock" | "insufficient_stock" | "below_moq";

export interface QuoteLine {
  productId: string;
  variantId: string;
  quantity: number;
  title: string;
  slug: string;
  image: ImageInput | null;
  size: string;
  colour: string;
  /** Current server price; never trust the price stored in the browser. */
  unitPrice: number;
  lineTotal: number;
  available: number;
  moq: number;
  packSize: number | null;
  issue: QuoteLineIssue | null;
}

export interface CartQuote {
  lines: QuoteLine[];
  subtotal: number;
  total: number;
  orderable: boolean;
}

/** Public order summary for the confirmation page; looked up by an unguessable token. */
export interface OrderConfirmation {
  orderNumber: string;
  token: string;
  createdAt: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  customer: {
    name: string;
    phone: string;
    line1: string;
    city: string;
    state: string;
    pincode: string;
  };
  note: string;
  items: {
    title: string;
    slug: string;
    /** Snapshot of the cover image key at order time. */
    imageKey: string | null;
    size: string;
    colour: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }[];
  subtotal: number;
  total: number;
}

// ---------- Pricing (shared by quote, order creation and tests) ----------

export interface PricedLine {
  unitPrice: number;
  quantity: number;
}

export function lineTotal({ unitPrice, quantity }: PricedLine): number {
  if (
    !Number.isInteger(unitPrice) ||
    !Number.isInteger(quantity) ||
    unitPrice < 0 ||
    quantity < 1
  ) {
    throw new RangeError("unitPrice must be integer paise and quantity a positive integer");
  }
  return unitPrice * quantity;
}

/** Money is integer paise throughout, so sums are exact. No shipping/tax in v1. */
export function orderTotals(lines: PricedLine[]): { subtotal: number; total: number } {
  const subtotal = lines.reduce((sum, l) => sum + lineTotal(l), 0);
  return { subtotal, total: subtotal };
}

/** Combine repeated variant lines (e.g. added twice from different tabs). */
export function mergeCartItems<T extends CartItemInput>(items: T[]): T[] {
  const byVariant = new Map<string, T>();
  for (const item of items) {
    const existing = byVariant.get(item.variantId);
    byVariant.set(
      item.variantId,
      existing
        ? { ...existing, quantity: Math.min(existing.quantity + item.quantity, MAX_LINE_QUANTITY) }
        : { ...item },
    );
  }
  return [...byVariant.values()];
}

import { z } from "zod";
import { objectIdSchema, paiseSchema } from "./common.js";
import { ORDER_STATUSES, PAYMENT_STATUSES, type OrderStatus, type PaymentStatus } from "./enums.js";

// ---------- Status workflow ----------

/** The happy path, in order. CANCELLED sits outside it. */
export const ORDER_FLOW = ["PENDING", "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED"] as const;

/**
 * Statuses an order can move to: any later step (the owner may skip steps, e.g. PENDING → SHIPPED),
 * or CANCELLED until it is delivered. DELIVERED and CANCELLED are final, so stock is never
 * re-reserved after a cancellation has returned it.
 */
export function nextOrderStatuses(status: OrderStatus): OrderStatus[] {
  if (status === "CANCELLED" || status === "DELIVERED") return [];
  const idx = ORDER_FLOW.indexOf(status);
  return [...ORDER_FLOW.slice(idx + 1), "CANCELLED"];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return nextOrderStatuses(from).includes(to);
}

/** Payment status follows the amount received, so it can never disagree with it. */
export function paymentStatusFor(amountReceived: number, total: number): PaymentStatus {
  if (amountReceived <= 0) return "UNPAID";
  return amountReceived >= total ? "PAID" : "PARTIAL";
}

// ---------- Admin orders ----------

const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const adminOrderListQuerySchema = z.object({
  /** Order number, customer name or phone. */
  q: z.string().trim().max(100).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  customerId: objectIdSchema.optional(),
  /** Inclusive calendar days in the store's time zone (IST). */
  from: dateParam,
  to: dateParam,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminOrderListQuery = z.input<typeof adminOrderListQuerySchema>;

export const orderStatusInputSchema = z.object({ status: z.enum(ORDER_STATUSES) });
export type OrderStatusInput = z.infer<typeof orderStatusInputSchema>;

/** Owner-editable order fields; payment status is derived from the amount. */
export const orderDetailsSchema = z.object({
  amountReceived: paiseSchema,
  paymentNotes: z.string().trim().max(1000),
  courier: z.string().trim().max(80),
  trackingNumber: z.string().trim().max(80),
  internalNotes: z.string().trim().max(2000),
});
export type OrderDetailsInput = z.infer<typeof orderDetailsSchema>;

/** PATCH body: any subset of the editable fields. */
export const orderUpdateInputSchema = orderDetailsSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type OrderUpdateInput = z.infer<typeof orderUpdateInputSchema>;

export interface AdminOrderSummary {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  customerId: string;
  customerName: string;
  phone: string;
  city: string;
  /** Total pieces/sets across all lines. */
  itemCount: number;
  total: number;
  amountReceived: number;
}

export interface AdminOrderItem {
  productId: string;
  variantId: string;
  title: string;
  slug: string;
  imageKey: string | null;
  size: string;
  colour: string;
  sku: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface AdminOrderDetail extends AdminOrderSummary {
  shippingAddress: {
    name: string;
    phone: string;
    line1: string;
    city: string;
    state: string;
    pincode: string;
  };
  note: string;
  items: AdminOrderItem[];
  subtotal: number;
  statusHistory: { status: OrderStatus; at: string }[];
  nextStatuses: OrderStatus[];
  paymentNotes: string;
  courier: string;
  trackingNumber: string;
  internalNotes: string;
  stockRestoredAt: string | null;
  updatedAt: string;
}

// ---------- Customers ----------

export const adminCustomerListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminCustomerListQuery = z.input<typeof adminCustomerListQuerySchema>;

export const customerUpdateInputSchema = z.object({ notes: z.string().trim().max(2000) });
export type CustomerUpdateInput = z.infer<typeof customerUpdateInputSchema>;

export interface AdminCustomerSummary {
  id: string;
  name: string;
  phone: string;
  city: string;
  orderCount: number;
  /** Sum of order totals, excluding cancelled orders. */
  totalSpent: number;
  lastOrderAt: string | null;
}

export interface AdminCustomerDetail extends AdminCustomerSummary {
  notes: string;
  lastAddress: AdminOrderDetail["shippingAddress"] | null;
  createdAt: string;
}

// ---------- Settings needed for invoices (the full settings page comes in Phase 7) ----------

export interface InvoiceStoreInfo {
  storeName: string;
  address: string;
  whatsappNumber: string;
  currency: string;
  gstin: string;
  showTaxInclusive: boolean;
  logoKey: string | null;
}

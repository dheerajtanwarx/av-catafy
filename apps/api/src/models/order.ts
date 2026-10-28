import { ORDER_STATUSES, PAYMENT_STATUSES } from "@catafy/types";
import { model, Schema, type InferSchemaType } from "mongoose";
import { paise } from "./shared.js";

export const addressSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    line1: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, trim: true, default: "" },
    pincode: { type: String, required: true, trim: true },
  },
  { _id: false },
);

/** Snapshot of the product at order time, so later product edits never change past orders. */
const orderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true },
    slug: { type: String, required: true },
    imageKey: { type: String, default: null },
    size: { type: String, required: true },
    colour: { type: String, required: true },
    sku: { type: String, default: null },
    unitPrice: { ...paise, required: true },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { ...paise, required: true },
  },
  { _id: false },
);

const statusChangeSchema = new Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    at: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    shippingAddress: { type: addressSchema, required: true },
    note: { type: String, trim: true, default: "" },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: { validator: (v: unknown[]) => v.length > 0, message: "Order needs items" },
    },
    subtotal: { ...paise, required: true },
    total: { ...paise, required: true },
    status: { type: String, enum: ORDER_STATUSES, default: "PENDING", required: true },
    statusHistory: { type: [statusChangeSchema], default: [] },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "UNPAID", required: true },
    amountReceived: { ...paise, default: 0 },
    paymentNotes: { type: String, default: "" },
    courier: { type: String, trim: true, default: "" },
    trackingNumber: { type: String, trim: true, default: "" },
    internalNotes: { type: String, default: "" },
    /** Set when a cancellation returns stock, so restoring is idempotent. */
    stockRestoredAt: { type: Date, default: null },
  },
  { timestamps: true, strict: true },
);

orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });

export type OrderDoc = InferSchemaType<typeof orderSchema>;
export const Order = model("Order", orderSchema);

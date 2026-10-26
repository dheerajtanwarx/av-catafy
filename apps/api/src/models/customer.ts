import { model, Schema, type InferSchemaType } from "mongoose";
import { addressSchema } from "./order.js";

/** Auto-created from orders, keyed by normalised 10-digit phone. Totals are aggregated from orders. */
const customerSchema = new Schema(
  {
    phone: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    lastAddress: { type: addressSchema, default: null },
    notes: { type: String, default: "" },
  },
  { timestamps: true, strict: true },
);

export type CustomerDoc = InferSchemaType<typeof customerSchema>;
export const Customer = model("Customer", customerSchema);

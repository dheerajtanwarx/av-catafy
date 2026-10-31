import { ANALYTICS_EVENT_TYPES, DEVICE_TYPES } from "@catafy/types";
import { model, Schema, type InferSchemaType } from "mongoose";

const RETENTION_SECONDS = 180 * 24 * 60 * 60;

/** Anonymous storefront events. No IPs are stored. */
const analyticsEventSchema = new Schema(
  {
    type: { type: String, enum: ANALYTICS_EVENT_TYPES, required: true },
    visitorId: { type: String, required: true },
    sessionId: { type: String, required: true },
    path: { type: String, required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", default: null },
    catalogueId: { type: Schema.Types.ObjectId, ref: "Catalogue", default: null },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    referrer: { type: String, default: "" },
    device: { type: String, enum: DEVICE_TYPES, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    strict: true,
    collection: "analyticsevents",
  },
);

analyticsEventSchema.index({ createdAt: 1, type: 1 });
analyticsEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_SECONDS });
// "Count each order once" check on every confirmation-page view.
analyticsEventSchema.index(
  { orderId: 1 },
  // Only order_placed events carry an orderId; the query names the type, so it can use this.
  { partialFilterExpression: { type: "order_placed" } },
);
analyticsEventSchema.index({ productId: 1, type: 1, createdAt: -1 });

export type AnalyticsEventDoc = InferSchemaType<typeof analyticsEventSchema>;
export const AnalyticsEvent = model("AnalyticsEvent", analyticsEventSchema);

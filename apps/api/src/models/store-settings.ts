import { model, Schema, type InferSchemaType } from "mongoose";
import { imageSchema } from "./shared.js";

export const STORE_SETTINGS_KEY = "store";

const storeSettingsSchema = new Schema(
  {
    // Fixed value + unique index guarantees a single settings document.
    key: { type: String, default: STORE_SETTINGS_KEY, unique: true, immutable: true },
    storeName: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    logo: { type: imageSchema, default: null },
    banner: { type: imageSchema, default: null },
    whatsappNumber: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    currency: { type: String, default: "INR", uppercase: true, minlength: 3, maxlength: 3 },
    accentColor: { type: String, default: "#9f4a54", match: /^#[0-9a-f]{6}$/i },
    socialLinks: {
      instagram: { type: String, trim: true, default: "" },
      facebook: { type: String, trim: true, default: "" },
      youtube: { type: String, trim: true, default: "" },
      website: { type: String, trim: true, default: "" },
    },
    orderConfirmationTemplate: { type: String, default: "" },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    gstin: { type: String, trim: true, uppercase: true, default: "" },
    showTaxInclusive: { type: Boolean, default: false },
  },
  { timestamps: true, strict: true, collection: "storesettings" },
);

export type StoreSettingsDoc = InferSchemaType<typeof storeSettingsSchema>;
export const StoreSettings = model("StoreSettings", storeSettingsSchema);

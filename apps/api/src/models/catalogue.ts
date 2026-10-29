import { model, Schema, type InferSchemaType } from "mongoose";
import { imageSchema } from "./shared.js";

const catalogueSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, default: "" },
    coverImage: { type: imageSchema, default: null },
    /** Ordered list: array position is the display order within the catalogue. */
    productIds: { type: [{ type: Schema.Types.ObjectId, ref: "Product" }], default: [] },
    isActive: { type: Boolean, default: true },
    isPrivate: { type: Boolean, default: false },
    /**
     * Stored as entered so the owner can re-share it (it guards a catalogue, not an account).
     * Never selected by default; only the admin API and the access check read it.
     */
    passcode: { type: String, select: false, default: null },
    hidePrices: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, strict: true },
);

catalogueSchema.index({ isActive: 1, isPrivate: 1, sortOrder: 1 });
catalogueSchema.index({ productIds: 1 });

export type CatalogueDoc = InferSchemaType<typeof catalogueSchema>;
export const Catalogue = model("Catalogue", catalogueSchema);

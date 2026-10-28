import { model, Schema, type InferSchemaType } from "mongoose";
import { imageSchema, paise } from "./shared.js";

const variantSchema = new Schema({
  size: { type: String, required: true, trim: true },
  colour: { type: String, required: true, trim: true },
  sku: { type: String, trim: true },
  stock: { type: Number, required: true, min: 0, default: 0 },
});

const productSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, default: "" },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    tags: { type: [String], default: [] },
    price: { ...paise, required: true },
    mrp: { ...paise, default: null },
    fabric: { type: String, trim: true, default: "" },
    care: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    moq: { type: Number, min: 1, default: 1 },
    /** Pieces per set when the product is sold only in packs; null = sold individually. */
    packSize: { type: Number, min: 1, default: null },
    /** Display order; images[0] is the cover. */
    images: { type: [imageSchema], default: [] },
    variants: { type: [variantSchema], default: [] },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: true },
);

productSchema.index({ title: "text", tags: "text" }, { weights: { title: 5, tags: 2 } });
productSchema.index({ deletedAt: 1, isActive: 1, categoryId: 1, createdAt: -1 });
productSchema.index({ deletedAt: 1, isActive: 1, isFeatured: 1 });
productSchema.index(
  { "variants.sku": 1 },
  { unique: true, partialFilterExpression: { "variants.sku": { $type: "string" } } },
);

export type ProductDoc = InferSchemaType<typeof productSchema>;
export type VariantDoc = InferSchemaType<typeof variantSchema>;
export const Product = model("Product", productSchema);

import { model, Schema, type InferSchemaType } from "mongoose";
import { imageSchema } from "./shared.js";

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    image: { type: imageSchema, default: null },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, strict: true },
);

categorySchema.index({ isActive: 1, sortOrder: 1 });

export type CategoryDoc = InferSchemaType<typeof categorySchema>;
export const Category = model("Category", categorySchema);

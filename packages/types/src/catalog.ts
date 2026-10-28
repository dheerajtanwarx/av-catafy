import { z } from "zod";
import { objectIdSchema, paiseSchema, slugSchema } from "./common.js";
import { imageInputSchema, type ImageInput } from "./uploads.js";

/** Empty string from a form field means "generate from the name/title". */
const optionalSlug = slugSchema.optional().or(z.literal("").transform(() => undefined));

// ---------- Categories ----------

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  slug: optionalSlug,
  description: z.string().trim().max(500).default(""),
  image: imageInputSchema.nullable().default(null),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});
export type CategoryInput = z.input<typeof categoryInputSchema>;

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: ImageInput | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
}

// ---------- Products ----------

export const variantInputSchema = z.object({
  /** Present for existing variants so their ids (referenced by orders) are preserved. */
  id: objectIdSchema.optional(),
  size: z.string().trim().min(1, "Size is required").max(40),
  colour: z.string().trim().min(1, "Colour is required").max(40),
  sku: z
    .string()
    .trim()
    .max(64)
    .transform((v) => v || undefined)
    .optional(),
  stock: z.number().int("Whole numbers only").min(0, "Stock cannot be negative"),
});
export type VariantInput = z.input<typeof variantInputSchema>;

export const PRODUCT_MAX_IMAGES = 12;

export const productInputSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(160),
    slug: optionalSlug,
    description: z.string().trim().max(5000).default(""),
    categoryId: objectIdSchema.nullable().default(null),
    tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(20).default([]),
    price: paiseSchema.min(100, "Price must be at least ₹1"),
    mrp: paiseSchema.nullable().default(null),
    fabric: z.string().trim().max(120).default(""),
    care: z.string().trim().max(500).default(""),
    isActive: z.boolean().default(true),
    isFeatured: z.boolean().default(false),
    moq: z.number().int().min(1).default(1),
    packSize: z.number().int().min(1).nullable().default(null),
    images: z.array(imageInputSchema).max(PRODUCT_MAX_IMAGES).default([]),
    variants: z.array(variantInputSchema).min(1, "Add at least one variant"),
  })
  .superRefine((p, ctx) => {
    if (p.mrp !== null && p.mrp < p.price) {
      ctx.addIssue({ code: "custom", path: ["mrp"], message: "MRP cannot be below the price" });
    }
    const seen = new Set<string>();
    p.variants.forEach((v, i) => {
      const combo = `${v.size.toLowerCase()}|${v.colour.toLowerCase()}`;
      if (seen.has(combo)) {
        ctx.addIssue({
          code: "custom",
          path: ["variants", i, "colour"],
          message: "Duplicate size and colour",
        });
      }
      seen.add(combo);
    });
    const skus = p.variants.map((v) => v.sku).filter(Boolean);
    if (new Set(skus).size !== skus.length) {
      ctx.addIssue({ code: "custom", path: ["variants"], message: "SKUs must be unique" });
    }
  });
export type ProductInput = z.input<typeof productInputSchema>;
export type ProductInputParsed = z.output<typeof productInputSchema>;

export const PRODUCT_SORTS = ["newest", "oldest", "price_asc", "price_desc", "title"] as const;

export const adminProductListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  categoryId: objectIdSchema.optional(),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  sort: z.enum(PRODUCT_SORTS).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminProductListQuery = z.input<typeof adminProductListQuerySchema>;

export interface VariantDto {
  id: string;
  size: string;
  colour: string;
  sku: string | null;
  stock: number;
}

export interface ProductDto {
  id: string;
  title: string;
  slug: string;
  description: string;
  categoryId: string | null;
  tags: string[];
  price: number;
  mrp: number | null;
  fabric: string;
  care: string;
  isActive: boolean;
  isFeatured: boolean;
  moq: number;
  packSize: number | null;
  images: ImageInput[];
  variants: VariantDto[];
  totalStock: number;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Money helpers shared by forms and displays. */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function formatPaise(paise: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
  }).format(paise / 100);
}

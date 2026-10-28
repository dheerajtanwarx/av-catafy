import { z } from "zod";
import { objectIdSchema, slugSchema } from "./common.js";
import type { ImageInput } from "./uploads.js";
import { imageInputSchema } from "./uploads.js";

// ---------- Catalogues (admin) ----------

const optionalSlug = slugSchema.optional().or(z.literal("").transform(() => undefined));

export const catalogueInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  slug: optionalSlug,
  description: z.string().trim().max(1000).default(""),
  coverImage: imageInputSchema.nullable().default(null),
  /** Display order = array order. */
  productIds: z
    .array(objectIdSchema)
    .max(500)
    .default([])
    .refine((ids) => new Set(ids).size === ids.length, "A product can only be added once"),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});
export type CatalogueInput = z.input<typeof catalogueInputSchema>;
export type CatalogueInputParsed = z.output<typeof catalogueInputSchema>;

export interface CatalogueProductSummary {
  id: string;
  title: string;
  slug: string;
  price: number;
  image: ImageInput | null;
  isActive: boolean;
}

export interface CatalogueDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  coverImage: ImageInput | null;
  productIds: string[];
  isActive: boolean;
  isPrivate: boolean;
  sortOrder: number;
  productCount: number;
  updatedAt: string;
}

export interface CatalogueDetailDto extends CatalogueDto {
  products: CatalogueProductSummary[];
}

// ---------- Storefront (public) ----------

export interface PublicStore {
  storeName: string;
  description: string;
  logo: ImageInput | null;
  banner: ImageInput | null;
  whatsappNumber: string;
  address: string;
  currency: string;
  accentColor: string;
  socialLinks: { instagram: string; facebook: string; youtube: string; website: string };
}

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: ImageInput | null;
  productCount: number;
}

export interface PublicProductCard {
  id: string;
  slug: string;
  title: string;
  price: number;
  mrp: number | null;
  discountPercent: number | null;
  image: ImageInput | null;
  /** Second image, shown on hover where available. */
  hoverImage: ImageInput | null;
  inStock: boolean;
}

export interface PublicVariant {
  id: string;
  size: string;
  colour: string;
  stock: number;
}

export interface PublicProduct extends Omit<PublicProductCard, "image" | "hoverImage"> {
  description: string;
  fabric: string;
  care: string;
  tags: string[];
  moq: number;
  packSize: number | null;
  images: ImageInput[];
  variants: PublicVariant[];
  category: { name: string; slug: string } | null;
  updatedAt: string;
}

export interface PublicCatalogue {
  slug: string;
  name: string;
  description: string;
  coverImage: ImageInput | null;
  productCount: number;
}

export interface PublicCatalogueDetail extends PublicCatalogue {
  products: PublicProductCard[];
}

export const STOREFRONT_SORTS = ["newest", "price_asc", "price_desc"] as const;
export type StorefrontSort = (typeof STOREFRONT_SORTS)[number];

export const publicProductListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: slugSchema.optional(),
  featured: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  sort: z.enum(STOREFRONT_SORTS).default("newest"),
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(24),
});
export type PublicProductListQuery = z.input<typeof publicProductListQuerySchema>;

export interface SitemapEntry {
  path: string;
  updatedAt: string;
}

/** Whole-percent discount from MRP, or null when there is no real discount. */
export function discountPercent(price: number, mrp: number | null | undefined): number | null {
  if (!mrp || mrp <= price) return null;
  const pct = Math.round(((mrp - price) / mrp) * 100);
  return pct > 0 ? pct : null;
}

/** Cache tag for everything the storefront shows; the API revalidates it after admin writes. */
export const CATALOG_CACHE_TAG = "catalog";

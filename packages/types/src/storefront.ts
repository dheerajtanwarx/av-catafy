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
  /** Private: the whole catalogue needs the passcode. */
  isPrivate: z.boolean().default(false),
  /** Price on request: anyone can browse; the passcode reveals prices and ordering. */
  hidePrices: z.boolean().default(false),
  /** New passcode; blank keeps the current one. Required the first time access is restricted. */
  passcode: z
    .string()
    .trim()
    .max(32)
    .refine((v) => v === "" || v.length >= 4, "Use at least 4 characters")
    .transform((v) => v || undefined)
    .optional(),
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
  hidePrices: boolean;
  /** Shown to the owner so it can be re-shared; null when none is set. */
  passcode: string | null;
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
  /** Null when the price is on request (hidden until a catalogue passcode is entered). */
  price: number | null;
  priceOnRequest: boolean;
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
  /** For price-on-request products: a catalogue whose passcode reveals the price. */
  unlockVia: { slug: string; name: string } | null;
  updatedAt: string;
}

/**
 * open: everything visible. prices_locked: browsable, prices need the passcode.
 * locked: private and not unlocked; only the name is returned.
 */
export type CatalogueAccess = "open" | "prices_locked" | "locked";

export interface PublicCatalogue {
  slug: string;
  name: string;
  description: string;
  coverImage: ImageInput | null;
  productCount: number;
  access: CatalogueAccess;
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

// ---------- Catalogue passcodes ----------

/** httpOnly cookie holding the catalogues this browser has unlocked (signed by the API). */
export const ACCESS_COOKIE = "catafy_access";

export const catalogueUnlockInputSchema = z.object({
  passcode: z.string().trim().min(1, "Enter the passcode").max(32),
});
export type CatalogueUnlockInput = z.infer<typeof catalogueUnlockInputSchema>;

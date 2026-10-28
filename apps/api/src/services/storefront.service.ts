import {
  discountPercent,
  type ImageInput,
  type Paginated,
  type PublicCatalogue,
  type PublicCatalogueDetail,
  type PublicCategory,
  type PublicProduct,
  type PublicProductCard,
  type PublicStore,
  type publicProductListQuerySchema,
  type SitemapEntry,
} from "@catafy/types";
import type { Types } from "mongoose";
import { type FilterQuery, type SortOrder } from "mongoose";
import type { z } from "zod";
import { AppError } from "../lib/errors.js";
import {
  Catalogue,
  Category,
  Product,
  STORE_SETTINGS_KEY,
  StoreSettings,
  type CatalogueDoc,
  type CategoryDoc,
  type ProductDoc,
  type VariantDoc,
} from "../models/index.js";

type ListQuery = z.output<typeof publicProductListQuerySchema>;
type ProductLean = ProductDoc & {
  _id: Types.ObjectId;
  variants: (VariantDoc & { _id: Types.ObjectId })[];
  updatedAt: Date;
};
type CategoryLean = CategoryDoc & { _id: Types.ObjectId; updatedAt: Date };
type CatalogueLean = CatalogueDoc & { _id: Types.ObjectId; updatedAt: Date };
type ImageLike = { key: string; width: number; height: number; alt: string } | null | undefined;

/**
 * The single definition of "a buyer may see this product".
 * Phase 6 extends this to hide products that only appear in private catalogues.
 */
export const VISIBLE_PRODUCT: FilterQuery<ProductDoc> = { isActive: true, deletedAt: null };
const VISIBLE_CATALOGUE: FilterQuery<CatalogueDoc> = { isActive: true, isPrivate: false };

const SORTS: Record<ListQuery["sort"], Record<string, SortOrder>> = {
  newest: { createdAt: -1 },
  price_asc: { price: 1, createdAt: -1 },
  price_desc: { price: -1, createdAt: -1 },
};

function image(i: ImageLike): ImageInput | null {
  return i ? { key: i.key, width: i.width, height: i.height, alt: i.alt } : null;
}

function toCard(p: ProductLean): PublicProductCard {
  return {
    id: p._id.toString(),
    slug: p.slug,
    title: p.title,
    price: p.price,
    mrp: p.mrp ?? null,
    discountPercent: discountPercent(p.price, p.mrp),
    image: image(p.images[0]),
    hoverImage: image(p.images[1]),
    inStock: p.variants.some((v) => v.stock > 0),
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function getStore(): Promise<PublicStore> {
  const s = await StoreSettings.findOne({ key: STORE_SETTINGS_KEY }).lean();
  if (!s) throw new Error("Store settings missing: run `pnpm seed`");
  return {
    storeName: s.storeName,
    description: s.description,
    logo: image(s.logo),
    banner: image(s.banner),
    whatsappNumber: s.whatsappNumber,
    address: s.address,
    currency: s.currency,
    accentColor: s.accentColor,
    socialLinks: {
      instagram: s.socialLinks?.instagram ?? "",
      facebook: s.socialLinks?.facebook ?? "",
      youtube: s.socialLinks?.youtube ?? "",
      website: s.socialLinks?.website ?? "",
    },
  };
}

export async function listProducts(query: ListQuery): Promise<Paginated<PublicProductCard>> {
  const filter: FilterQuery<ProductDoc> = { ...VISIBLE_PRODUCT };
  if (query.featured !== undefined) filter.isFeatured = query.featured;
  if (query.category) {
    const category = await Category.findOne({ slug: query.category, isActive: true })
      .select("_id")
      .lean();
    if (!category)
      return { items: [], page: query.page, limit: query.limit, total: 0, totalPages: 1 };
    filter.categoryId = category._id;
  }
  if (query.q) {
    // Substring match (e.g. "kurt" finds "Kurti"); fine at boutique catalogue sizes.
    const re = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [{ title: re }, { tags: re }];
  }

  const [items, total] = await Promise.all([
    Product.find(filter)
      .sort(SORTS[query.sort])
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean<ProductLean[]>(),
    Product.countDocuments(filter),
  ]);
  return {
    items: items.map(toCard),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

export async function getProduct(slug: string): Promise<PublicProduct> {
  const p = await Product.findOne({ ...VISIBLE_PRODUCT, slug }).lean<ProductLean>();
  if (!p) throw AppError.notFound("Product not found");
  const category = p.categoryId
    ? await Category.findOne({ _id: p.categoryId, isActive: true }).select("name slug").lean()
    : null;
  const { image: _cover, hoverImage: _hover, ...card } = toCard(p);
  return {
    ...card,
    description: p.description,
    fabric: p.fabric,
    care: p.care,
    tags: p.tags,
    moq: p.moq,
    packSize: p.packSize ?? null,
    images: p.images.map((i) => image(i)!),
    variants: p.variants.map((v) => ({
      id: v._id.toString(),
      size: v.size,
      colour: v.colour,
      stock: v.stock,
    })),
    category: category ? { name: category.name, slug: category.slug } : null,
    updatedAt: p.updatedAt.toISOString(),
  };
}

/** Active categories that have at least one visible product. */
export async function listCategories(): Promise<PublicCategory[]> {
  const counts = await Product.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { ...VISIBLE_PRODUCT, categoryId: { $ne: null } } },
    { $group: { _id: "$categoryId", count: { $sum: 1 } } },
  ]);
  const byId = new Map(counts.map((c) => [c._id.toString(), c.count]));
  const categories = await Category.find({ isActive: true, _id: { $in: [...byId.keys()] } })
    .sort({ sortOrder: 1, name: 1 })
    .lean<CategoryLean[]>();
  return categories.map((c) => ({
    id: c._id.toString(),
    name: c.name,
    slug: c.slug,
    description: c.description,
    image: image(c.image),
    productCount: byId.get(c._id.toString()) ?? 0,
  }));
}

async function visibleProductsById(ids: Types.ObjectId[]): Promise<Map<string, ProductLean>> {
  const products = await Product.find({ ...VISIBLE_PRODUCT, _id: { $in: ids } }).lean<
    ProductLean[]
  >();
  return new Map(products.map((p) => [p._id.toString(), p]));
}

/** Public catalogues with at least one visible product. */
export async function listCatalogues(): Promise<PublicCatalogue[]> {
  const catalogues = await Catalogue.find(VISIBLE_CATALOGUE)
    .sort({ sortOrder: 1, createdAt: -1 })
    .lean<CatalogueLean[]>();
  const visible = await visibleProductsById(catalogues.flatMap((c) => c.productIds));
  return catalogues
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      description: c.description,
      coverImage:
        image(c.coverImage) ??
        image(c.productIds.map((id) => visible.get(id.toString())).find(Boolean)?.images[0]),
      productCount: c.productIds.filter((id) => visible.has(id.toString())).length,
    }))
    .filter((c) => c.productCount > 0);
}

export async function getCatalogue(slug: string): Promise<PublicCatalogueDetail> {
  // Private catalogues stay 404 until passcode access lands in Phase 6.
  const c = await Catalogue.findOne({ ...VISIBLE_CATALOGUE, slug }).lean<CatalogueLean>();
  if (!c) throw AppError.notFound("Catalogue not found");
  const visible = await visibleProductsById(c.productIds);
  const products = c.productIds.flatMap((id) => {
    const p = visible.get(id.toString());
    return p ? [toCard(p)] : [];
  });
  return {
    slug: c.slug,
    name: c.name,
    description: c.description,
    coverImage: image(c.coverImage) ?? products[0]?.image ?? null,
    productCount: products.length,
    products,
  };
}

export async function sitemap(): Promise<SitemapEntry[]> {
  const [products, categories, catalogues] = await Promise.all([
    Product.find(VISIBLE_PRODUCT)
      .select("slug updatedAt")
      .lean<{ slug: string; updatedAt: Date }[]>(),
    listCategories(),
    Catalogue.find(VISIBLE_CATALOGUE)
      .select("slug updatedAt")
      .lean<{ slug: string; updatedAt: Date }[]>(),
  ]);
  const now = new Date().toISOString();
  return [
    ...products.map((p) => ({ path: `/p/${p.slug}`, updatedAt: p.updatedAt.toISOString() })),
    ...catalogues.map((c) => ({ path: `/c/${c.slug}`, updatedAt: c.updatedAt.toISOString() })),
    ...categories.map((c) => ({ path: `/products?category=${c.slug}`, updatedAt: now })),
  ];
}

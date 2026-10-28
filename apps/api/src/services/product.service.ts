import type {
  adminProductListQuerySchema,
  Paginated,
  ProductDto,
  ProductInputParsed,
} from "@catafy/types";
import { Types, type FilterQuery, type SortOrder } from "mongoose";
import type { z } from "zod";
import { AppError } from "../lib/errors.js";
import { uniqueSlug } from "../lib/slug.js";
import { Category, Product, type ProductDoc, type VariantDoc } from "../models/index.js";

type ListQuery = z.output<typeof adminProductListQuerySchema>;
type ProductLean = ProductDoc & {
  _id: Types.ObjectId;
  variants: (VariantDoc & { _id: Types.ObjectId })[];
  createdAt: Date;
  updatedAt: Date;
};

const SORTS: Record<ListQuery["sort"], Record<string, SortOrder>> = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  price_asc: { price: 1, createdAt: -1 },
  price_desc: { price: -1, createdAt: -1 },
  title: { title: 1 },
};

export function toProductDto(p: ProductLean): ProductDto {
  return {
    id: p._id.toString(),
    title: p.title,
    slug: p.slug,
    description: p.description,
    categoryId: p.categoryId ? p.categoryId.toString() : null,
    tags: p.tags,
    price: p.price,
    mrp: p.mrp ?? null,
    fabric: p.fabric,
    care: p.care,
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    moq: p.moq,
    packSize: p.packSize ?? null,
    images: p.images.map((i) => ({ key: i.key, width: i.width, height: i.height, alt: i.alt })),
    variants: p.variants.map((v) => ({
      id: v._id.toString(),
      size: v.size,
      colour: v.colour,
      sku: v.sku ?? null,
      stock: v.stock,
    })),
    totalStock: p.variants.reduce((sum, v) => sum + v.stock, 0),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listProducts(query: ListQuery): Promise<Paginated<ProductDto>> {
  const filter: FilterQuery<ProductDoc> = { deletedAt: null };
  if (query.status !== "all") filter.isActive = query.status === "active";
  if (query.categoryId) filter.categoryId = new Types.ObjectId(query.categoryId);
  if (query.q) {
    // Prefix/substring match suits the admin list (the storefront uses the text index).
    const re = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [{ title: re }, { tags: re }, { "variants.sku": re }];
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
    items: items.map(toProductDto),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

export async function getProduct(id: string): Promise<ProductDto> {
  const product = await Product.findOne({ _id: id, deletedAt: null }).lean<ProductLean>();
  if (!product) throw AppError.notFound("Product not found");
  return toProductDto(product);
}

async function assertCategoryExists(categoryId: string | null): Promise<void> {
  if (categoryId && !(await Category.exists({ _id: categoryId }))) {
    throw AppError.badRequest("Category does not exist", { field: "categoryId" });
  }
}

export async function createProduct(input: ProductInputParsed): Promise<ProductDto> {
  await assertCategoryExists(input.categoryId);
  const slug = await uniqueSlug(Product, input.slug ?? input.title);
  const created = await Product.create({
    ...input,
    slug,
    variants: input.variants.map(({ id: _id, ...v }) => v),
  });
  return toProductDto(created.toObject<ProductLean>());
}

export async function updateProduct(id: string, input: ProductInputParsed): Promise<ProductDto> {
  const product = await Product.findOne({ _id: id, deletedAt: null });
  if (!product) throw AppError.notFound("Product not found");
  await assertCategoryExists(input.categoryId);

  // Keep existing variant ids: past orders and carts reference them.
  const existingIds = new Set(product.variants.map((v) => v._id.toString()));
  const variants = input.variants.map(({ id: variantId, ...v }) => {
    if (variantId && !existingIds.has(variantId)) {
      throw AppError.badRequest("Variant does not belong to this product", { variantId });
    }
    return variantId ? { _id: new Types.ObjectId(variantId), ...v } : v;
  });

  const slug = input.slug ? await uniqueSlug(Product, input.slug, product._id) : product.slug;
  // Removed images stay in R2 on purpose: past orders snapshot their image keys.
  product.set({ ...input, slug, variants });
  await product.save();
  return toProductDto(product.toObject<ProductLean>());
}

/** Soft delete. The slug is freed so a new product can reuse it. */
export async function deleteProduct(id: string): Promise<void> {
  const product = await Product.findOne({ _id: id, deletedAt: null });
  if (!product) throw AppError.notFound("Product not found");
  product.deletedAt = new Date();
  product.isActive = false;
  product.slug = `${product.slug}--deleted-${product._id.toString().slice(-6)}`;
  // Free SKUs too, otherwise the unique index blocks re-creating the product.
  for (const v of product.variants) v.sku = undefined;
  await product.save();
}

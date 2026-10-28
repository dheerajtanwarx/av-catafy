import type { CategoryDto, categoryInputSchema } from "@catafy/types";
import type { Types } from "mongoose";
import type { z } from "zod";
import { AppError } from "../lib/errors.js";
import { uniqueSlug } from "../lib/slug.js";
import { Category, Product, type CategoryDoc } from "../models/index.js";

type CategoryInputParsed = z.output<typeof categoryInputSchema>;
type CategoryLean = CategoryDoc & { _id: Types.ObjectId };

function toDto(c: CategoryLean, productCount: number): CategoryDto {
  return {
    id: c._id.toString(),
    name: c.name,
    slug: c.slug,
    description: c.description,
    image: c.image
      ? { key: c.image.key, width: c.image.width, height: c.image.height, alt: c.image.alt }
      : null,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    productCount,
  };
}

async function productCounts(ids: Types.ObjectId[]): Promise<Map<string, number>> {
  const rows = await Product.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { categoryId: { $in: ids }, deletedAt: null } },
    { $group: { _id: "$categoryId", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id.toString(), r.count]));
}

export async function listCategories(): Promise<CategoryDto[]> {
  const categories = await Category.find().sort({ sortOrder: 1, name: 1 }).lean<CategoryLean[]>();
  const counts = await productCounts(categories.map((c) => c._id));
  return categories.map((c) => toDto(c, counts.get(c._id.toString()) ?? 0));
}

export async function createCategory(input: CategoryInputParsed): Promise<CategoryDto> {
  const slug = await uniqueSlug(Category, input.slug ?? input.name);
  const created = await Category.create({ ...input, slug });
  return toDto(created.toObject<CategoryLean>(), 0);
}

export async function updateCategory(id: string, input: CategoryInputParsed): Promise<CategoryDto> {
  const category = await Category.findById(id);
  if (!category) throw AppError.notFound("Category not found");
  const slug = input.slug ? await uniqueSlug(Category, input.slug, category._id) : category.slug;
  category.set({ ...input, slug });
  await category.save();
  const counts = await productCounts([category._id]);
  return toDto(category.toObject<CategoryLean>(), counts.get(id) ?? 0);
}

export async function deleteCategory(id: string): Promise<void> {
  const inUse = await Product.countDocuments({ categoryId: id, deletedAt: null });
  if (inUse > 0) {
    throw AppError.conflict(
      `This category has ${inUse} product${inUse === 1 ? "" : "s"}. Move them to another category first.`,
    );
  }
  const result = await Category.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw AppError.notFound("Category not found");
}

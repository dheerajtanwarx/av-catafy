import type {
  CatalogueDetailDto,
  CatalogueDto,
  CatalogueInputParsed,
  CatalogueProductSummary,
} from "@catafy/types";
import { Types } from "mongoose";
import { AppError } from "../lib/errors.js";
import { uniqueSlug } from "../lib/slug.js";
import { Catalogue, Product, type CatalogueDoc, type ProductDoc } from "../models/index.js";

type CatalogueLean = CatalogueDoc & { _id: Types.ObjectId; updatedAt: Date };
type ProductSummaryLean = Pick<ProductDoc, "title" | "slug" | "price" | "images" | "isActive"> & {
  _id: Types.ObjectId;
};

function toDto(c: CatalogueLean, productCount: number): CatalogueDto {
  return {
    id: c._id.toString(),
    name: c.name,
    slug: c.slug,
    description: c.description,
    coverImage: c.coverImage
      ? {
          key: c.coverImage.key,
          width: c.coverImage.width,
          height: c.coverImage.height,
          alt: c.coverImage.alt,
        }
      : null,
    productIds: c.productIds.map((id) => id.toString()),
    isActive: c.isActive,
    isPrivate: c.isPrivate,
    hidePrices: c.hidePrices,
    passcode: c.passcode ?? null,
    sortOrder: c.sortOrder,
    productCount,
    updatedAt: c.updatedAt.toISOString(),
  };
}

/** Products still live (not soft-deleted), keyed by id, in no particular order. */
async function liveProducts(ids: Types.ObjectId[]): Promise<Map<string, ProductSummaryLean>> {
  const products = await Product.find({ _id: { $in: ids }, deletedAt: null })
    .select("title slug price images isActive")
    .lean<ProductSummaryLean[]>();
  return new Map(products.map((p) => [p._id.toString(), p]));
}

export async function listCatalogues(): Promise<CatalogueDto[]> {
  const catalogues = await Catalogue.find()
    .select("+passcode")
    .sort({ sortOrder: 1, createdAt: -1 })
    .lean<CatalogueLean[]>();
  const live = await liveProducts(catalogues.flatMap((c) => c.productIds));
  return catalogues.map((c) =>
    toDto(c, c.productIds.filter((id) => live.has(id.toString())).length),
  );
}

export async function getCatalogue(id: string): Promise<CatalogueDetailDto> {
  const catalogue = await Catalogue.findById(id).select("+passcode").lean<CatalogueLean>();
  if (!catalogue) throw AppError.notFound("Catalogue not found");
  const live = await liveProducts(catalogue.productIds);
  const products: CatalogueProductSummary[] = catalogue.productIds.flatMap((pid) => {
    const p = live.get(pid.toString());
    if (!p) return [];
    const img = p.images[0];
    return [
      {
        id: p._id.toString(),
        title: p.title,
        slug: p.slug,
        price: p.price,
        image: img ? { key: img.key, width: img.width, height: img.height, alt: img.alt } : null,
        isActive: p.isActive,
      },
    ];
  });
  return { ...toDto(catalogue, products.length), products };
}

async function assertProductsExist(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const found = await Product.countDocuments({ _id: { $in: ids }, deletedAt: null });
  if (found !== ids.length)
    throw AppError.badRequest("Some products no longer exist", { field: "productIds" });
}

/** Restricting a catalogue needs a passcode, either new in this request or already saved. */
function assertPasscode(input: CatalogueInputParsed, existing: string | null): void {
  if ((input.isPrivate || input.hidePrices) && !input.passcode && !existing) {
    throw AppError.badRequest("Set a passcode to restrict this catalogue", { field: "passcode" });
  }
}

export async function createCatalogue(input: CatalogueInputParsed): Promise<CatalogueDetailDto> {
  await assertProductsExist(input.productIds);
  assertPasscode(input, null);
  const slug = await uniqueSlug(Catalogue, input.slug ?? input.name);
  const { passcode, ...fields } = input;
  const created = await Catalogue.create({ ...fields, slug, passcode: passcode ?? null });
  return getCatalogue(created._id.toString());
}

export async function updateCatalogue(
  id: string,
  input: CatalogueInputParsed,
): Promise<CatalogueDetailDto> {
  const catalogue = await Catalogue.findById(id).select("+passcode");
  if (!catalogue) throw AppError.notFound("Catalogue not found");
  await assertProductsExist(input.productIds);
  assertPasscode(input, catalogue.passcode ?? null);
  const slug = input.slug ? await uniqueSlug(Catalogue, input.slug, catalogue._id) : catalogue.slug;
  // A blank passcode keeps the current one; a new one revokes everyone who unlocked the old one.
  const { passcode, ...fields } = input;
  catalogue.set({
    ...fields,
    slug,
    productIds: input.productIds.map((p) => new Types.ObjectId(p)),
    ...(passcode ? { passcode } : {}),
  });
  await catalogue.save();
  return getCatalogue(id);
}

export async function deleteCatalogue(id: string): Promise<void> {
  const result = await Catalogue.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw AppError.notFound("Catalogue not found");
}

import {
  CATALOG_CACHE_TAG,
  type Paginated,
  type PublicCatalogue,
  type PublicCatalogueDetail,
  type PublicCategory,
  type PublicProduct,
  type PublicProductCard,
  type StorefrontSort,
  type PublicStore,
  type SitemapEntry,
} from "@catafy/types";
import { cache } from "react";

// Server-only: Server Components call the API directly (not through the /api/v1 rewrite).
const API = `${process.env.API_INTERNAL_URL}/api/v1/public`;

/**
 * Cached in the Next.js data cache under one tag. The API revalidates the tag after every admin
 * write; the hourly revalidate is only a safety net if that call is missed.
 */
async function get<T>(
  path: string,
  query?: Record<string, string | number | undefined>,
): Promise<T | null> {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {}))
    if (v !== undefined && v !== "") search.set(k, String(v));
  const res = await fetch(`${API}${path}${search.size ? `?${search}` : ""}`, {
    next: { tags: [CATALOG_CACHE_TAG], revalidate: 3600 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Storefront API ${path} failed with ${res.status}`);
  return (await res.json()) as T;
}

async function getOrThrow<T>(
  path: string,
  query?: Record<string, string | number | undefined>,
): Promise<T> {
  const data = await get<T>(path, query);
  if (data === null) throw new Error(`Storefront API ${path} returned 404`);
  return data;
}

export const getStore = cache(() => getOrThrow<PublicStore>("/store"));
export const getCategories = cache(() =>
  getOrThrow<{ items: PublicCategory[] }>("/categories").then((r) => r.items),
);
export const getCatalogues = cache(() =>
  getOrThrow<{ items: PublicCatalogue[] }>("/catalogues").then((r) => r.items),
);
export const getProduct = cache((slug: string) =>
  get<PublicProduct>(`/products/${encodeURIComponent(slug)}`),
);
export const getCatalogue = cache((slug: string) =>
  get<PublicCatalogueDetail>(`/catalogues/${encodeURIComponent(slug)}`),
);

export interface ProductQuery {
  q?: string;
  category?: string;
  featured?: boolean;
  sort?: StorefrontSort;
  page?: number;
  limit?: number;
}

export function getProducts(query: ProductQuery) {
  return getOrThrow<Paginated<PublicProductCard>>("/products", {
    ...query,
    featured: query.featured === undefined ? undefined : String(query.featured),
  });
}

export function getSitemap() {
  return getOrThrow<{ items: SitemapEntry[] }>("/sitemap").then((r) => r.items);
}

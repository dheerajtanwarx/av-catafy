import {
  ACCESS_COOKIE,
  CATALOG_CACHE_TAG,
  type OrderConfirmation,
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
import { cookies } from "next/headers";
import { cache } from "react";

// Server-only: Server Components call the API directly (not through the /api/v1 rewrite).
const API = `${process.env.API_INTERNAL_URL}/api/v1/public`;

type Query = Record<string, string | number | undefined>;

/**
 * Anonymous requests are cached in the Next.js data cache under one tag; the API revalidates the
 * tag after every admin write, and the hourly revalidate is only a safety net.
 *
 * A buyer who unlocked a catalogue has an access cookie: their requests forward it and are never
 * cached, so unlocked products or prices can't leak into the shared cache.
 */
async function get<T>(path: string, query?: Query, personal = true): Promise<T | null> {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {}))
    if (v !== undefined && v !== "") search.set(k, String(v));
  const access = personal ? (await cookies()).get(ACCESS_COOKIE)?.value : undefined;
  const res = await fetch(
    `${API}${path}${search.size ? `?${search}` : ""}`,
    access
      ? { cache: "no-store", headers: { cookie: `${ACCESS_COOKIE}=${access}` } }
      : { next: { tags: [CATALOG_CACHE_TAG], revalidate: 3600 } },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Storefront API ${path} failed with ${res.status}`);
  return (await res.json()) as T;
}

async function getOrThrow<T>(path: string, query?: Query, personal = true): Promise<T> {
  const data = await get<T>(path, query, personal);
  if (data === null) throw new Error(`Storefront API ${path} returned 404`);
  return data;
}

// Store settings and the sitemap are the same for everyone.
export const getStore = cache(() => getOrThrow<PublicStore>("/store", undefined, false));
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

/** Order confirmation: per-buyer data, never cached. */
export async function getOrderConfirmation(token: string): Promise<OrderConfirmation | null> {
  const res = await fetch(`${API}/orders/${encodeURIComponent(token)}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Order lookup failed with ${res.status}`);
  return (await res.json()) as OrderConfirmation;
}

export function getSitemap() {
  return getOrThrow<{ items: SitemapEntry[] }>("/sitemap", undefined, false).then((r) => r.items);
}

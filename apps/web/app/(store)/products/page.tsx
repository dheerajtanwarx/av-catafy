import { publicProductListQuerySchema } from "@catafy/types";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ListingFilters } from "@/components/store/listing-filters";
import { Pagination } from "@/components/store/pagination";
import { ProductGrid } from "@/components/store/product-card";
import { getCategories, getProducts, getStore } from "@/lib/storefront";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

async function parseQuery(searchParams: SearchParams) {
  const raw = await searchParams;
  const parsed = publicProductListQuerySchema.safeParse({
    q: first(raw.q) || undefined,
    category: first(raw.category) || undefined,
    sort: first(raw.sort) || undefined,
    page: first(raw.page) || undefined,
  });
  return parsed.success ? parsed.data : publicProductListQuerySchema.parse({});
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const query = await parseQuery(searchParams);
  const category = query.category
    ? (await getCategories()).find((c) => c.slug === query.category)
    : undefined;
  return {
    title: query.q ? `Search: ${query.q}` : (category?.name ?? "Shop all"),
    description: category?.description || undefined,
    // Search result pages shouldn't be indexed; category pages should.
    robots: query.q ? { index: false } : undefined,
    alternates: { canonical: category ? `/products?category=${category.slug}` : "/products" },
  };
}

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await parseQuery(searchParams);
  const [store, categories, result] = await Promise.all([
    getStore(),
    getCategories(),
    getProducts({ ...query, limit: 24 }),
  ]);
  const category = categories.find((c) => c.slug === query.category);

  const hrefFor = (page: number) => {
    const p = new URLSearchParams();
    if (query.q) p.set("q", query.q);
    if (query.category) p.set("category", query.category);
    if (query.sort !== "newest") p.set("sort", query.sort);
    if (page > 1) p.set("page", String(page));
    return `/products${p.size ? `?${p}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <header className="mb-8">
        <h1 className="font-display text-4xl font-medium md:text-5xl">
          {category?.name ?? "Shop all"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {result.total} {result.total === 1 ? "piece" : "pieces"}
          {query.q && <> for “{query.q}”</>}
        </p>
      </header>
      <div className="mb-8">
        <Suspense>
          <ListingFilters categories={categories} />
        </Suspense>
      </div>
      {result.items.length > 0 ? (
        <>
          <ProductGrid products={result.items} currency={store.currency} priorityCount={4} />
          <Pagination page={result.page} totalPages={result.totalPages} hrefFor={hrefFor} />
        </>
      ) : (
        <div className="py-20 text-center">
          <p className="font-display text-2xl">Nothing found</p>
          <p className="mt-2 text-sm text-muted-foreground">Try a different word or category.</p>
        </div>
      )}
    </div>
  );
}

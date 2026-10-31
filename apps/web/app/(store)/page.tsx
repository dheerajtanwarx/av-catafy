import Image from "next/image";
import Link from "next/link";
import { ProductGrid } from "@/components/store/product-card";
import { SectionHeading } from "@/components/store/section-heading";
import { imageUrl } from "@/lib/images";
import { getCatalogues, getCategories, getProducts, getStore } from "@/lib/storefront";

export default async function HomePage() {
  const [store, categories, catalogues, featured, latest] = await Promise.all([
    getStore(),
    getCategories(),
    getCatalogues(),
    getProducts({ featured: true, limit: 8 }),
    getProducts({ sort: "newest", limit: 8 }),
  ]);
  const empty = latest.total === 0;

  return (
    <>
      <section className="relative">
        {store.banner ? (
          <div className="relative h-[70svh] min-h-[420px] w-full overflow-hidden bg-muted">
            <Image
              src={imageUrl(store.banner.key)}
              alt={store.banner.alt || store.storeName}
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 mx-auto max-w-7xl px-4 pb-12 text-white md:px-6 md:pb-16">
              <h1 className="max-w-2xl font-display text-5xl leading-[1.05] font-medium md:text-7xl">
                {store.storeName}
              </h1>
              {store.description && (
                <p className="mt-3 max-w-md text-white/85">{store.description}</p>
              )}
              <Link
                href="/products"
                className="mt-6 inline-block rounded-full bg-white px-7 py-3 text-sm font-medium text-black hover:bg-white/90"
              >
                Shop the collection
              </Link>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-7xl px-4 py-20 text-center md:px-6 md:py-28">
            <p className="text-xs tracking-[0.35em] text-muted-foreground uppercase">New season</p>
            <h1 className="mx-auto mt-4 max-w-3xl font-display text-5xl leading-[1.05] font-medium md:text-7xl">
              {store.storeName}
            </h1>
            {store.description && (
              <p className="mx-auto mt-4 max-w-md text-muted-foreground">{store.description}</p>
            )}
            {!empty && (
              <Link
                href="/products"
                className="mt-8 inline-block rounded-full bg-foreground px-7 py-3 text-sm font-medium text-background hover:opacity-90"
              >
                Shop the collection
              </Link>
            )}
          </div>
        )}
      </section>

      <div className="mx-auto max-w-7xl space-y-20 px-4 pt-16 md:px-6">
        {empty && (
          <p className="text-center text-muted-foreground">
            New pieces are on their way. Check back soon.
          </p>
        )}

        {categories.length > 0 && (
          <section aria-labelledby="categories-heading">
            <SectionHeading title={<span id="categories-heading">Shop by category</span>} />
            <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-4 md:gap-6 md:overflow-visible md:px-0">
              {categories.map((c) => (
                <li key={c.id} className="w-[42vw] shrink-0 snap-start md:w-auto">
                  <Link href={`/products?category=${c.slug}`} className="group block">
                    <div className="relative aspect-[3/4] overflow-hidden rounded-sm bg-muted">
                      {c.image && (
                        <Image
                          src={imageUrl(c.image.key)}
                          alt=""
                          fill
                          sizes="(min-width: 768px) 25vw, 42vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                      <span className="absolute inset-x-0 bottom-0 p-4 font-display text-2xl text-white">
                        {c.name}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {featured.items.length > 0 && (
          <section aria-labelledby="featured-heading">
            <SectionHeading title={<span id="featured-heading">Featured</span>} />
            <ProductGrid products={featured.items} currency={store.currency} />
          </section>
        )}

        {catalogues.length > 0 && (
          <section aria-labelledby="collections-heading">
            <SectionHeading title={<span id="collections-heading">Collections</span>} />
            <ul className="grid gap-6 md:grid-cols-2">
              {catalogues.map((c) => (
                <li key={c.slug}>
                  <Link href={`/c/${c.slug}`} className="group block">
                    <div className="relative aspect-[16/10] overflow-hidden rounded-sm bg-muted">
                      {c.coverImage && (
                        <Image
                          src={imageUrl(c.coverImage.key)}
                          alt=""
                          fill
                          sizes="(min-width: 768px) 50vw, 100vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                        <p className="font-display text-3xl">{c.name}</p>
                        <p className="text-sm text-white/80">{c.productCount} pieces</p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!empty && (
          <section aria-labelledby="new-heading">
            <SectionHeading title={<span id="new-heading">New arrivals</span>} href="/products" />
            <ProductGrid
              products={latest.items}
              currency={store.currency}
              priorityCount={store.banner ? 0 : 2}
            />
          </section>
        )}
      </div>
    </>
  );
}

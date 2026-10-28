import { formatPaise } from "@catafy/types";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Price } from "@/components/store/price";
import { ProductActions } from "@/components/store/product-actions";
import { ProductGallery } from "@/components/store/product-gallery";
import { imageUrl } from "@/lib/images";
import { ogImageUrl, SITE_URL, truncate } from "@/lib/seo";
import { getProduct, getStore } from "@/lib/storefront";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const [product, store] = await Promise.all([getProduct(slug), getStore()]);
  if (!product) return { title: "Not found", robots: { index: false } };

  const price = formatPaise(product.price, store.currency);
  // Price in the title so WhatsApp/Instagram link previews show it.
  const title = `${product.title} – ${price}`;
  const description = truncate(
    product.description ||
      [product.fabric, product.category?.name].filter(Boolean).join(" · ") ||
      title,
  );
  const cover = product.images[0];
  return {
    title,
    description,
    alternates: { canonical: `/p/${product.slug}` },
    openGraph: {
      type: "website",
      title,
      description,
      url: `${SITE_URL}/p/${product.slug}`,
      images: cover
        ? [
            {
              url: ogImageUrl(cover.key),
              width: 1200,
              height: Math.round((cover.height / cover.width) * 1200),
              alt: product.title,
            },
          ]
        : undefined,
    },
    twitter: { card: "summary_large_image", title, description },
    other: {
      "product:price:amount": String(product.price / 100),
      "product:price:currency": store.currency,
    },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [product, store] = await Promise.all([getProduct(slug), getStore()]);
  if (!product) notFound();

  const url = `${SITE_URL}/p/${product.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description || undefined,
    image: product.images.map((i) => imageUrl(i.key)),
    offers: {
      "@type": "Offer",
      price: (product.price / 100).toFixed(2),
      priceCurrency: store.currency,
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url,
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-muted-foreground md:mb-6">
        <ol className="flex flex-wrap gap-1.5">
          <li>
            <Link href="/products" className="hover:text-foreground">
              Shop
            </Link>
          </li>
          {product.category && (
            <>
              <li aria-hidden>/</li>
              <li>
                <Link
                  href={`/products?category=${product.category.slug}`}
                  className="hover:text-foreground"
                >
                  {product.category.name}
                </Link>
              </li>
            </>
          )}
        </ol>
      </nav>

      <div className="grid gap-8 md:grid-cols-2 md:gap-12 lg:gap-16">
        <ProductGallery images={product.images} title={product.title} />

        <div className="md:sticky md:top-24 md:self-start">
          <h1 className="font-display text-3xl leading-tight font-medium md:text-4xl">
            {product.title}
          </h1>
          <div className="mt-3">
            <Price
              price={product.price}
              mrp={product.mrp}
              discountPercent={product.discountPercent}
              currency={store.currency}
              size="lg"
            />
            {product.mrp && (
              <p className="mt-1 text-xs text-muted-foreground">Inclusive of all taxes</p>
            )}
          </div>

          <div className="mt-8">
            <ProductActions
              product={product}
              whatsappNumber={store.whatsappNumber}
              url={url}
              currency={store.currency}
            />
          </div>

          <div className="mt-10 divide-y border-y">
            {product.description && (
              <details className="group py-4" open>
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
                  Description{" "}
                  <span className="text-lg transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                  {product.description}
                </p>
              </details>
            )}
            {(product.fabric || product.care) && (
              <details className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
                  Fabric &amp; care{" "}
                  <span className="text-lg transition-transform group-open:rotate-45">+</span>
                </summary>
                <dl className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {product.fabric && (
                    <div>
                      <dt className="inline text-foreground">Fabric: </dt>
                      <dd className="inline">{product.fabric}</dd>
                    </div>
                  )}
                  {product.care && (
                    <div>
                      <dt className="inline text-foreground">Care: </dt>
                      <dd className="inline whitespace-pre-line">{product.care}</dd>
                    </div>
                  )}
                </dl>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { ProductGrid } from "@/components/store/product-card";
import { UnlockForm } from "@/components/store/unlock-form";
import { imageUrl } from "@/lib/images";
import { ogImageUrl, SITE_URL, truncate } from "@/lib/seo";
import { getCatalogue, getStore } from "@/lib/storefront";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const catalogue = await getCatalogue(slug);
  if (!catalogue) return { title: "Not found", robots: { index: false } };
  if (catalogue.access === "locked") {
    // Link previews show only the name; nothing behind the passcode.
    return {
      title: catalogue.name,
      description: "A private collection. Enter the passcode to view.",
      robots: { index: false, follow: false },
      openGraph: { type: "website", title: catalogue.name, url: `${SITE_URL}/c/${catalogue.slug}` },
    };
  }
  const description = truncate(
    catalogue.description || `${catalogue.productCount} pieces in ${catalogue.name}.`,
  );
  return {
    title: catalogue.name,
    description,
    alternates: { canonical: `/c/${catalogue.slug}` },
    openGraph: {
      type: "website",
      title: catalogue.name,
      description,
      url: `${SITE_URL}/c/${catalogue.slug}`,
      images: catalogue.coverImage
        ? [{ url: ogImageUrl(catalogue.coverImage.key), alt: catalogue.name }]
        : undefined,
    },
  };
}

export default async function CataloguePage({ params }: { params: Params }) {
  const { slug } = await params;
  const [catalogue, store] = await Promise.all([getCatalogue(slug), getStore()]);
  if (!catalogue) notFound();

  if (catalogue.access === "locked") {
    return (
      <div className="mx-auto flex min-h-[60svh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
        <LockKeyhole className="size-8 text-brand" aria-hidden />
        <p className="mt-4 text-xs tracking-[0.2em] text-muted-foreground uppercase">
          Private collection
        </p>
        <h1 className="mt-2 font-display text-4xl font-medium md:text-5xl">{catalogue.name}</h1>
        <p className="mt-3 mb-8 text-sm text-muted-foreground">
          Enter the passcode {store.storeName} shared with you to view this collection.
        </p>
        <UnlockForm slug={catalogue.slug} cta="View" />
      </div>
    );
  }

  return (
    <>
      <header className="relative">
        {catalogue.coverImage ? (
          <div className="relative h-[45svh] min-h-[300px] overflow-hidden bg-muted">
            <Image
              src={imageUrl(catalogue.coverImage.key)}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 mx-auto max-w-7xl px-4 pb-10 text-white md:px-6">
              <h1 className="font-display text-5xl font-medium md:text-6xl">{catalogue.name}</h1>
              <p className="mt-2 text-sm text-white/80">{catalogue.productCount} pieces</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-7xl px-4 pt-12 md:px-6">
            <h1 className="font-display text-5xl font-medium">{catalogue.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{catalogue.productCount} pieces</p>
          </div>
        )}
      </header>
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        {catalogue.description && (
          <p className="mb-10 max-w-2xl whitespace-pre-line text-muted-foreground">
            {catalogue.description}
          </p>
        )}
        {catalogue.access === "prices_locked" && (
          <div className="mb-10 flex max-w-2xl flex-col gap-3 rounded-sm border bg-card p-5 sm:flex-row sm:items-center">
            <p className="text-sm sm:flex-1">
              <strong className="font-medium">Prices on request.</strong> Have a passcode? Enter it
              to see prices and order.
            </p>
            <div className="sm:w-72">
              <UnlockForm slug={catalogue.slug} cta="See prices" />
            </div>
          </div>
        )}
        <h2 className="sr-only">Pieces in this collection</h2>
        <ProductGrid
          products={catalogue.products}
          currency={store.currency}
          priorityCount={catalogue.coverImage ? 0 : 4}
        />
      </div>
    </>
  );
}

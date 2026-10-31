import type { Metadata } from "next";
import { connection } from "next/server";
import type { CSSProperties, ReactNode } from "react";
import { PageTracker } from "@/components/store/page-tracker";
import { StoreFooter } from "@/components/store/store-footer";
import { StoreHeader } from "@/components/store/store-header";
import { Toaster } from "@/components/ui/sonner";
import { ogImageUrl, SITE_URL, truncate } from "@/lib/seo";
import { getCategories, getStore } from "@/lib/storefront";

export async function generateMetadata(): Promise<Metadata> {
  const store = await getStore();
  const description = truncate(
    store.description || `Shop the latest collection from ${store.storeName}.`,
  );
  return {
    title: { default: store.storeName, template: `%s · ${store.storeName}` },
    description,
    openGraph: {
      type: "website",
      siteName: store.storeName,
      url: SITE_URL,
      description,
      ...(store.banner ? { images: [{ url: ogImageUrl(store.banner.key) }] } : {}),
    },
  };
}

export default async function StoreLayout({ children }: { children: ReactNode }) {
  // Render per request (data still comes from the tagged fetch cache), so builds never need the API.
  await connection();
  const [store, categories] = await Promise.all([getStore(), getCategories()]);
  return (
    <div
      style={{ "--brand": store.accentColor } as CSSProperties}
      className="flex min-h-dvh flex-col"
    >
      <a
        href="#main"
        className="sr-only z-50 bg-background px-4 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <StoreHeader store={store} categories={categories} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <StoreFooter store={store} />
      <Toaster position="top-center" />
      <PageTracker />
    </div>
  );
}

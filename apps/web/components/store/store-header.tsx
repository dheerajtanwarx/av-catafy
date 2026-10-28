import type { PublicCategory, PublicStore } from "@catafy/types";
import { Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { imageUrl } from "@/lib/images";
import { MobileMenu } from "./mobile-menu";

export function StoreHeader({
  store,
  categories,
}: {
  store: PublicStore;
  categories: PublicCategory[];
}) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 md:px-6">
        <div className="flex items-center gap-6">
          <MobileMenu categories={categories} storeName={store.storeName} />
          <nav className="hidden items-center gap-6 text-sm md:flex" aria-label="Main">
            <Link href="/products" className="hover:text-brand">
              Shop all
            </Link>
            {categories.slice(0, 4).map((c) => (
              <Link key={c.id} href={`/products?category=${c.slug}`} className="hover:text-brand">
                {c.name}
              </Link>
            ))}
          </nav>
        </div>
        <Link
          href="/"
          className="flex items-center justify-center gap-2"
          aria-label={`${store.storeName} home`}
        >
          {store.logo ? (
            <Image
              src={imageUrl(store.logo.key)}
              alt={store.storeName}
              width={Math.round((store.logo.width / store.logo.height) * 40)}
              height={40}
              className="h-10 w-auto"
              priority
            />
          ) : (
            <span className="font-display text-2xl font-semibold tracking-wide md:text-3xl">
              {store.storeName}
            </span>
          )}
        </Link>
        <div className="flex justify-end">
          <Link
            href="/products?focus=search"
            className="rounded-full p-2 hover:bg-accent"
            aria-label="Search products"
          >
            <Search className="size-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

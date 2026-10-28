import type { PublicProductCard } from "@catafy/types";
import Image from "next/image";
import Link from "next/link";
import { imageUrl } from "@/lib/images";
import { Price } from "./price";

const SIZES = "(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 48vw";

export function ProductCard({
  product,
  currency,
  priority = false,
}: {
  product: PublicProductCard;
  currency: string;
  priority?: boolean;
}) {
  const { image, hoverImage } = product;
  return (
    <Link href={`/p/${product.slug}`} className="group block focus-visible:outline-none">
      <div className="relative aspect-[3/4] overflow-hidden rounded-sm bg-muted group-focus-visible:ring-2 group-focus-visible:ring-ring">
        {image ? (
          <>
            <Image
              src={imageUrl(image.key)}
              alt={image.alt || product.title}
              fill
              sizes={SIZES}
              priority={priority}
              className="object-cover transition-[transform,opacity] duration-500 group-hover:scale-[1.03]"
            />
            {hoverImage && (
              <Image
                src={imageUrl(hoverImage.key)}
                alt=""
                fill
                sizes={SIZES}
                className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              />
            )}
          </>
        ) : (
          <div className="flex size-full items-center justify-center font-display text-lg text-muted-foreground">
            {product.title}
          </div>
        )}
        {!product.inStock && (
          <span className="absolute top-2 left-2 rounded-sm bg-background/90 px-2 py-0.5 text-xs tracking-wide uppercase">
            Sold out
          </span>
        )}
        {product.inStock && product.discountPercent && (
          <span className="absolute top-2 left-2 rounded-sm bg-brand px-2 py-0.5 text-xs font-medium text-brand-foreground">
            {product.discountPercent}% off
          </span>
        )}
      </div>
      <div className="mt-3 space-y-1">
        <h3 className="line-clamp-2 text-sm leading-snug group-hover:underline group-hover:underline-offset-4">
          {product.title}
        </h3>
        <Price
          price={product.price}
          mrp={product.mrp}
          discountPercent={product.discountPercent}
          currency={currency}
        />
      </div>
    </Link>
  );
}

export function ProductGrid({
  products,
  currency,
  priorityCount = 0,
}: {
  products: PublicProductCard[];
  currency: string;
  priorityCount?: number;
}) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 md:gap-x-6 xl:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} currency={currency} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}

"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useCartCount } from "@/lib/cart";

export function CartButton() {
  const count = useCartCount();
  return (
    <Link
      href="/cart"
      className="relative rounded-full p-2 hover:bg-accent"
      aria-label={count ? `Bag, ${count} item${count === 1 ? "" : "s"}` : "Bag"}
    >
      <ShoppingBag className="size-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex min-w-4.5 items-center justify-center rounded-full bg-brand px-1 text-[10px] leading-4.5 font-medium text-brand-foreground tabular-nums">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

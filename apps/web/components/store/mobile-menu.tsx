"use client";

import type { PublicCategory } from "@catafy/types";
import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function MobileMenu({
  categories,
  storeName,
}: {
  categories: PublicCategory[];
  storeName: string;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="-ml-2 rounded-full p-2 hover:bg-accent md:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 px-6 py-8">
        <SheetTitle className="font-display text-2xl">{storeName}</SheetTitle>
        <nav className="mt-6 flex flex-col gap-4 text-lg" aria-label="Main">
          <Link href="/" onClick={close}>
            Home
          </Link>
          <Link href="/products" onClick={close}>
            Shop all
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/products?category=${c.slug}`}
              onClick={close}
              className="text-muted-foreground"
            >
              {c.name}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

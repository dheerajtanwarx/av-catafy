"use client";

import type { PublicCategory, StorefrontSort } from "@catafy/types";
import { Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const SORT_LABELS: Record<StorefrontSort, string> = {
  newest: "Newest",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
};

export function ListingFilters({ categories }: { categories: PublicCategory[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const activeCategory = params.get("category");
  const sort = (params.get("sort") as StorefrontSort | null) ?? "newest";

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    next.delete("focus");
    startTransition(() =>
      router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }),
    );
  }

  // Debounced search-as-you-type.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q.trim() === current) return;
    const id = setTimeout(() => update({ q: q.trim() || null }), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to typing
  }, [q]);

  useEffect(() => {
    if (params.get("focus") === "search") inputRef.current?.focus();
  }, [params]);

  function categoryHref(slug: string | null) {
    const next = new URLSearchParams(params);
    if (slug) next.set("category", slug);
    else next.delete("category");
    next.delete("page");
    return `${pathname}${next.size ? `?${next}` : ""}`;
  }

  return (
    <div className={cn("space-y-4 transition-opacity", pending && "opacity-60")}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search kurtis, sarees, cotton…"
            aria-label="Search products"
            className="h-11 pl-9"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <Select value={sort} onValueChange={(v) => update({ sort: v === "newest" ? null : v })}>
          <SelectTrigger className="h-11 sm:w-52" aria-label="Sort by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {categories.length > 0 && (
        <nav aria-label="Categories" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
          <ul className="flex gap-2">
            {[{ slug: null, name: "All" }, ...categories].map((c) => {
              const active = (c.slug ?? null) === activeCategory;
              return (
                <li key={c.slug ?? "all"}>
                  <Link
                    href={categoryHref(c.slug)}
                    scroll={false}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-block rounded-full border px-4 py-1.5 text-sm whitespace-nowrap transition-colors",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "hover:border-foreground",
                    )}
                  >
                    {c.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}

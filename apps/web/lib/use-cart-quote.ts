"use client";

import type { CartQuote } from "@catafy/types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { CartLine } from "./cart";

/** Server-side pricing and availability for the bag; refreshed whenever it changes. */
export function useCartQuote(lines: CartLine[]) {
  const items = lines.map(({ productId, variantId, quantity }) => ({
    productId,
    variantId,
    quantity,
  }));
  return useQuery({
    queryKey: ["cart-quote", items],
    queryFn: () => api<CartQuote>("/public/cart/quote", { method: "POST", body: { items } }),
    enabled: items.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export const ISSUE_TEXT = {
  unavailable: "No longer available. Please remove it.",
  out_of_stock: "Sold out. Please remove it.",
  insufficient_stock: (available: number) => `Only ${available} left. Reduce the quantity.`,
  below_moq: (moq: number) => `Minimum order is ${moq} for this product.`,
} as const;

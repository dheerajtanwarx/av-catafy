"use client";

import { MAX_CART_LINES, MAX_LINE_QUANTITY, type CartItemInput } from "@catafy/types";
import { useSyncExternalStore } from "react";

/** What the bag remembers locally. Prices here are display hints only; the server re-prices. */
export interface CartLine extends CartItemInput {
  title: string;
  slug: string;
  imageKey: string | null;
  size: string;
  colour: string;
  price: number;
}

const KEY = "catafy-cart-v1";
const EMPTY: CartLine[] = [];
let cache: CartLine[] | null = null;
const listeners = new Set<() => void>();

function read(): CartLine[] {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    cache = Array.isArray(parsed) ? (parsed as CartLine[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(lines: CartLine[]) {
  cache = lines;
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    // Private mode / storage full: the bag still works for this tab.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep tabs in sync.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export const cart = {
  add(line: CartLine) {
    const lines = read();
    const existing = lines.find((l) => l.variantId === line.variantId);
    if (existing) {
      write(
        lines.map((l) =>
          l.variantId === line.variantId
            ? { ...line, quantity: Math.min(l.quantity + line.quantity, MAX_LINE_QUANTITY) }
            : l,
        ),
      );
    } else if (lines.length < MAX_CART_LINES) {
      write([...lines, line]);
    } else {
      throw new Error(`Your bag can hold up to ${MAX_CART_LINES} different items.`);
    }
  },
  setQuantity(variantId: string, quantity: number) {
    const q = Math.max(1, Math.min(MAX_LINE_QUANTITY, Math.floor(quantity)));
    write(read().map((l) => (l.variantId === variantId ? { ...l, quantity: q } : l)));
  },
  remove(variantId: string) {
    write(read().filter((l) => l.variantId !== variantId));
  },
  clear() {
    write([]);
  },
};

/** Lines in the bag; empty during SSR, filled after hydration. */
export function useCart(): CartLine[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function useCartCount(): number {
  return useCart().reduce((sum, l) => sum + l.quantity, 0);
}

import type { Metadata } from "next";
import { CartView } from "@/components/store/cart-view";
import { getStore } from "@/lib/storefront";

export const metadata: Metadata = { title: "Your bag", robots: { index: false } };

export default async function CartPage() {
  const store = await getStore();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
      <h1 className="mb-8 font-display text-4xl font-medium md:text-5xl">Your bag</h1>
      <CartView currency={store.currency} />
    </div>
  );
}

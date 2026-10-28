import type { Metadata } from "next";
import { CheckoutForm } from "@/components/store/checkout-form";
import { getStore } from "@/lib/storefront";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const store = await getStore();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
      <h1 className="mb-8 font-display text-4xl font-medium md:text-5xl">Checkout</h1>
      <CheckoutForm currency={store.currency} />
    </div>
  );
}

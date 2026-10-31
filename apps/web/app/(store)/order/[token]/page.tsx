import { formatPaise } from "@catafy/types";
import { CheckCircle2, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { imageUrl } from "@/lib/images";
import { orderWhatsappMessage, variantLabel } from "@/lib/order-message";
import { getOrderConfirmation, getStore } from "@/lib/storefront";
import { whatsappLink } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Order placed",
  robots: { index: false, follow: false },
};

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [order, store] = await Promise.all([getOrderConfirmation(token), getStore()]);
  if (!order) notFound();

  const money = (p: number) => formatPaise(p, store.currency);
  const sendOnWhatsapp = whatsappLink(
    store.whatsappNumber,
    orderWhatsappMessage(order, store.storeName, store.currency),
  );
  const c = order.customer;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 md:py-16">
      <div className="text-center">
        <CheckCircle2 className="mx-auto size-12 text-brand" aria-hidden />
        <h1 className="mt-4 font-display text-4xl font-medium md:text-5xl">
          Thank you, {c.name.split(" ")[0]}!
        </h1>
        <p className="mt-3 text-muted-foreground">
          Your order <strong className="text-foreground">{order.orderNumber}</strong> has been
          placed.
        </p>
      </div>

      {sendOnWhatsapp ? (
        <div className="mt-8 rounded-sm border bg-card p-6 text-center">
          <p className="text-sm">
            <strong>One last step:</strong> send your order to us on WhatsApp so we can confirm it
            and share payment details.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-4 h-12 w-full rounded-full bg-[#25D366] text-base text-white hover:bg-[#1ebe5b]"
          >
            <a href={sendOnWhatsapp} target="_blank" rel="noreferrer">
              <MessageCircle className="size-5" aria-hidden />
              Send order on WhatsApp
            </a>
          </Button>
        </div>
      ) : (
        <p className="mt-8 rounded-sm bg-muted p-4 text-center text-sm">
          We&apos;ll contact you on {c.phone} to confirm your order and share payment details.
        </p>
      )}

      <section className="mt-10" aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="mb-4 font-display text-2xl">
          Order summary
        </h2>
        <ul className="divide-y border-y">
          {order.items.map((i, n) => (
            <li key={n} className="flex gap-4 py-4 text-sm">
              <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-sm bg-muted">
                {i.imageKey && (
                  <Image
                    src={imageUrl(i.imageKey)}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p>{i.title}</p>
                <p className="text-xs text-muted-foreground">
                  {[variantLabel(i.size, i.colour), `Qty ${i.quantity}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <p className="tabular-nums">{money(i.lineTotal)}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between text-base font-medium">
          <span>Total</span>
          <span className="tabular-nums">{money(order.total)}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Payment: pending. Pay once your order is confirmed.
        </p>
      </section>

      <section className="mt-10 grid gap-6 text-sm sm:grid-cols-2">
        <div>
          <h3 className="mb-1 font-medium">Delivering to</h3>
          <p className="text-muted-foreground">
            {c.name}
            <br />
            {c.line1}
            <br />
            {c.city}
            {c.state && `, ${c.state}`} – {c.pincode}
            <br />
            {c.phone}
          </p>
        </div>
        {order.note && (
          <div>
            <h3 className="mb-1 font-medium">Your note</h3>
            <p className="whitespace-pre-line text-muted-foreground">{order.note}</p>
          </div>
        )}
      </section>

      <p className="mt-12 text-center">
        <Link href="/products" className="text-sm underline underline-offset-4 hover:text-brand">
          Continue shopping
        </Link>
      </p>
    </div>
  );
}

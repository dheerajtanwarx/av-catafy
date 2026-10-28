"use client";

import { formatPaise, type QuoteLine } from "@catafy/types";
import { AlertCircle, ShoppingBag, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { cart, useCart } from "@/lib/cart";
import { imageUrl } from "@/lib/images";
import { variantLabel } from "@/lib/order-message";
import { ISSUE_TEXT, useCartQuote } from "@/lib/use-cart-quote";
import { QuantityStepper } from "./quantity-stepper";

export function issueText(line: QuoteLine): string | null {
  switch (line.issue) {
    case "unavailable":
      return ISSUE_TEXT.unavailable;
    case "out_of_stock":
      return ISSUE_TEXT.out_of_stock;
    case "insufficient_stock":
      return ISSUE_TEXT.insufficient_stock(line.available);
    case "below_moq":
      return ISSUE_TEXT.below_moq(line.moq);
    default:
      return null;
  }
}

export function CartView({ currency }: { currency: string }) {
  const lines = useCart();
  const quote = useCartQuote(lines);
  const byVariant = new Map(quote.data?.lines.map((l) => [l.variantId, l]));

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <ShoppingBag className="size-10 text-muted-foreground" aria-hidden />
        <p className="font-display text-3xl">Your bag is empty</p>
        <Button asChild size="lg" className="rounded-full">
          <Link href="/products">Start shopping</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
      <ul className="divide-y border-y">
        {lines.map((line) => {
          const q = byVariant.get(line.variantId);
          const problem = q ? issueText(q) : null;
          const price = q && q.issue !== "unavailable" ? q.unitPrice : line.price;
          const label = variantLabel(line.size, line.colour);
          return (
            <li key={line.variantId} className="flex gap-4 py-5">
              <Link
                href={`/p/${line.slug}`}
                className="relative h-32 w-24 shrink-0 overflow-hidden rounded-sm bg-muted"
              >
                {line.imageKey && (
                  <Image
                    src={imageUrl(line.imageKey)}
                    alt=""
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                )}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/p/${line.slug}`} className="line-clamp-2 text-sm hover:underline">
                      {line.title}
                    </Link>
                    {label && <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => cart.remove(line.variantId)}
                    className="-m-1 rounded p-1 text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${line.title}`}
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <p className="mt-1 text-sm tabular-nums">
                  {formatPaise(price, currency)}
                  {q && q.issue !== "unavailable" && q.unitPrice !== line.price && (
                    <span className="ml-2 text-xs text-muted-foreground">(price updated)</span>
                  )}
                </p>
                {problem && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                    <AlertCircle className="size-3.5 shrink-0" aria-hidden />
                    {problem}
                  </p>
                )}
                <div className="mt-auto flex items-end justify-between pt-3">
                  <QuantityStepper
                    size="sm"
                    value={line.quantity}
                    onChange={(v) => cart.setQuantity(line.variantId, v)}
                    max={Math.max(line.quantity, q?.available ?? 999)}
                    label={`Quantity for ${line.title}`}
                  />
                  <p className="text-sm font-medium tabular-nums">
                    {formatPaise(price * line.quantity, currency)}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <aside className="h-fit space-y-4 rounded-sm bg-muted/60 p-6 lg:sticky lg:top-24">
        <h2 className="font-display text-2xl">Order summary</h2>
        {quote.isError ? (
          <p className="text-sm text-destructive">{errorMessage(quote.error)}</p>
        ) : !quote.data ? (
          <Skeleton className="h-6 w-full" />
        ) : (
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd className="tabular-nums">{formatPaise(quote.data.subtotal, currency)}</dd>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <dt>Delivery & payment</dt>
              <dd>Confirmed on WhatsApp</dd>
            </div>
            <div className="flex justify-between border-t pt-3 text-base font-medium">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatPaise(quote.data.total, currency)}</dd>
            </div>
          </dl>
        )}
        <Button
          asChild={quote.data?.orderable}
          size="lg"
          className="w-full rounded-full"
          disabled={!quote.data?.orderable}
        >
          {quote.data?.orderable ? <Link href="/checkout">Checkout</Link> : <span>Checkout</span>}
        </Button>
        {quote.data && !quote.data.orderable && (
          <p className="text-xs text-destructive">Fix the highlighted items to continue.</p>
        )}
        <p className="text-xs text-muted-foreground">
          No online payment needed. Pay by UPI, bank transfer or cash on delivery once we confirm
          your order.
        </p>
      </aside>
    </div>
  );
}

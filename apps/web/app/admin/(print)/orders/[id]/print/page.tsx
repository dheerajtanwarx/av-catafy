"use client";

import { formatPaise } from "@catafy/types";
import { Printer } from "lucide-react";
import Link from "next/link";
import { use, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { imageUrl } from "@/lib/images";
import { variantLabel } from "@/lib/order-message";
import { formatDate, PAYMENT_STATUS_LABEL } from "@/lib/order-status";
import { useOrderPrint } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** Printable invoice (default) or packing slip (`?doc=slip`, no prices). Print → Save as PDF. */
export default function PrintOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ doc?: string }>;
}) {
  const { id } = use(params);
  const isSlip = use(searchParams).doc === "slip";
  const { data, isLoading, isError, error } = useOrderPrint(id);

  useEffect(() => {
    if (data) document.title = `${isSlip ? "Packing slip" : "Invoice"} ${data.order.orderNumber}`;
  }, [data, isSlip]);

  if (isLoading) return <Skeleton className="mx-auto mt-8 h-[60vh] max-w-3xl" />;
  if (isError || !data) return <p className="p-8 text-destructive">{errorMessage(error)}</p>;

  const { order, store } = data;
  const money = (p: number) => formatPaise(p, store.currency);
  const a = order.shippingAddress;
  const due = Math.max(0, order.total - order.amountReceived);

  return (
    <div className="min-h-dvh bg-muted/40 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between gap-2 px-4 print:hidden">
        <nav className="flex gap-1 text-sm" aria-label="Document">
          {[
            { label: "Invoice", href: `/admin/orders/${id}/print`, active: !isSlip },
            { label: "Packing slip", href: `/admin/orders/${id}/print?doc=slip`, active: isSlip },
          ].map((t) => (
            <Link
              key={t.label}
              href={t.href}
              replace
              aria-current={t.active ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5",
                t.active ? "bg-background font-medium shadow-sm" : "text-muted-foreground",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <Button onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden />
          Print
        </Button>
      </div>

      <article className="mx-auto max-w-3xl bg-white p-8 text-sm text-neutral-900 shadow-sm sm:p-12 print:max-w-none print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b pb-6">
          <div className="flex items-start gap-3">
            {store.logoKey && (
              // eslint-disable-next-line @next/next/no-img-element -- plain img prints reliably
              <img src={imageUrl(store.logoKey)} alt="" className="size-14 object-contain" />
            )}
            <div>
              <p className="font-display text-2xl font-semibold">{store.storeName}</p>
              {store.address && (
                <p className="max-w-xs whitespace-pre-line text-neutral-600">{store.address}</p>
              )}
              {store.whatsappNumber && (
                <p className="text-neutral-600">WhatsApp: {store.whatsappNumber}</p>
              )}
              {!isSlip && store.gstin && <p className="text-neutral-600">GSTIN: {store.gstin}</p>}
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-xl font-semibold tracking-wide uppercase">
              {isSlip ? "Packing slip" : "Invoice"}
            </h1>
            <dl className="mt-2 grid grid-cols-[auto_auto] justify-end gap-x-3 text-neutral-600">
              <dt>{isSlip ? "Order" : "Invoice no."}</dt>
              <dd className="font-medium text-neutral-900 tabular-nums">{order.orderNumber}</dd>
              <dt>Date</dt>
              <dd className="tabular-nums">{formatDate(order.createdAt)}</dd>
              {!isSlip && (
                <>
                  <dt>Payment</dt>
                  <dd>{PAYMENT_STATUS_LABEL[order.paymentStatus]}</dd>
                </>
              )}
            </dl>
            {order.status === "CANCELLED" && (
              <p className="mt-2 font-semibold text-red-700 uppercase">Cancelled</p>
            )}
          </div>
        </header>

        <section className="grid gap-6 border-b py-6 sm:grid-cols-2">
          <div>
            <h2 className="mb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              {isSlip ? "Ship to" : "Bill & ship to"}
            </h2>
            <p className={cn(isSlip && "text-base")}>
              <strong>{a.name}</strong>
              <br />
              {a.line1}
              <br />
              {a.city}
              {a.state && `, ${a.state}`} – {a.pincode}
              <br />
              Phone: {a.phone}
            </p>
          </div>
          {(order.courier || order.trackingNumber) && (
            <div>
              <h2 className="mb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
                Shipping
              </h2>
              <p>
                {order.courier}
                {order.trackingNumber && (
                  <>
                    <br />
                    Tracking: {order.trackingNumber}
                  </>
                )}
              </p>
            </div>
          )}
        </section>

        <table className="mt-6 w-full border-collapse">
          <thead>
            <tr className="border-b text-left text-xs tracking-wide text-neutral-500 uppercase">
              <th className="w-8 py-2 font-semibold">#</th>
              <th className="py-2 font-semibold">Item</th>
              <th className="py-2 text-right font-semibold">Qty</th>
              {isSlip ? (
                <th className="w-16 py-2 text-center font-semibold">Packed</th>
              ) : (
                <>
                  <th className="py-2 text-right font-semibold">Rate</th>
                  <th className="py-2 text-right font-semibold">Amount</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {order.items.map((i, n) => (
              <tr key={i.variantId} className="border-b align-top break-inside-avoid">
                <td className="py-2 text-neutral-500 tabular-nums">{n + 1}</td>
                <td className="py-2">
                  <p className="font-medium">{i.title}</p>
                  <p className="text-xs text-neutral-600">
                    {[variantLabel(i.size, i.colour), i.sku && `SKU ${i.sku}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </td>
                <td className="py-2 text-right tabular-nums">{i.quantity}</td>
                {isSlip ? (
                  <td className="py-2 text-center">
                    <span className="inline-block size-4 border border-neutral-400" aria-hidden />
                  </td>
                ) : (
                  <>
                    <td className="py-2 text-right tabular-nums">{money(i.unitPrice)}</td>
                    <td className="py-2 text-right tabular-nums">{money(i.lineTotal)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {isSlip ? (
          <div className="mt-4 flex justify-end text-neutral-600">
            Total pieces: <strong className="ml-1 text-neutral-900">{order.itemCount}</strong>
          </div>
        ) : (
          <dl className="mt-4 ml-auto grid max-w-64 grid-cols-2 gap-y-1 tabular-nums">
            <dt className="text-neutral-600">Subtotal</dt>
            <dd className="text-right">{money(order.subtotal)}</dd>
            <dt className="border-t pt-1 font-semibold">Total</dt>
            <dd className="border-t pt-1 text-right font-semibold">{money(order.total)}</dd>
            {order.amountReceived > 0 && (
              <>
                <dt className="text-neutral-600">Received</dt>
                <dd className="text-right">{money(order.amountReceived)}</dd>
                <dt className="font-medium">Balance due</dt>
                <dd className="text-right font-medium">{money(due)}</dd>
              </>
            )}
          </dl>
        )}

        {!isSlip && store.showTaxInclusive && (
          <p className="mt-4 text-right text-xs text-neutral-600">
            All prices are inclusive of applicable taxes.
          </p>
        )}

        {order.note && (
          <section className="mt-8">
            <h2 className="mb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              Buyer&apos;s note
            </h2>
            <p className="whitespace-pre-line">{order.note}</p>
          </section>
        )}

        <footer className="mt-10 border-t pt-4 text-center text-xs text-neutral-500">
          Thank you for shopping with {store.storeName}.
        </footer>
      </article>
    </div>
  );
}

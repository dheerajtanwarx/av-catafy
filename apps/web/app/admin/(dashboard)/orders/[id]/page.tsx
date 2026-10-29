"use client";

import {
  formatPaise,
  renderOrderMessage,
  type AdminOrderDetail,
  type OrderStatus,
} from "@catafy/types";
import { ArrowLeft, Loader2, MessageCircle, Package, Printer } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { use } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { OrderDetailsForm } from "@/components/admin/order-details-form";
import { OrderStatusBadge } from "@/components/admin/order-badges";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { imageUrl } from "@/lib/images";
import { variantLabel } from "@/lib/order-message";
import { formatDateTime, ORDER_STATUS_LABEL } from "@/lib/order-status";
import { useChangeOrderStatus, useOrder, useSettings } from "@/lib/queries";
import { whatsappLink } from "@/lib/whatsapp";

const NEXT_ACTION: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: "Confirm order",
  PACKED: "Mark packed",
  SHIPPED: "Mark shipped",
  DELIVERED: "Mark delivered",
};

function StatusCard({ order }: { order: AdminOrderDetail }) {
  const change = useChangeOrderStatus(order.id);
  const forward = order.nextStatuses.filter((s) => s !== "CANCELLED");
  const [primary, ...skips] = forward;
  const canCancel = order.nextStatuses.includes("CANCELLED");

  async function move(status: OrderStatus) {
    try {
      await change.mutateAsync(status);
      toast.success(
        status === "CANCELLED"
          ? "Order cancelled. Stock has been returned."
          : `Order ${ORDER_STATUS_LABEL[status].toLowerCase()}`,
      );
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Status</CardTitle>
        <OrderStatusBadge status={order.status} />
      </CardHeader>
      <CardContent className="space-y-4">
        {primary && (
          <div className="space-y-2">
            <Button className="w-full" disabled={change.isPending} onClick={() => move(primary)}>
              {change.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {NEXT_ACTION[primary] ?? ORDER_STATUS_LABEL[primary]}
            </Button>
            {skips.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>Skip to:</span>
                {skips.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={change.isPending}
                    onClick={() => move(s)}
                    className="underline underline-offset-2 hover:text-foreground disabled:opacity-50"
                  >
                    {ORDER_STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <ol className="space-y-2 border-l pl-4 text-sm">
          {order.statusHistory.map((h, i) => (
            <li key={i} className="relative">
              <span
                className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-border"
                aria-hidden
              />
              <span className="font-medium">{ORDER_STATUS_LABEL[h.status]}</span>
              <span className="ml-2 text-xs text-muted-foreground">{formatDateTime(h.at)}</span>
            </li>
          ))}
        </ol>

        {canCancel && (
          <ConfirmDialog
            title={`Cancel ${order.orderNumber}?`}
            description="The items go back into stock and the order can't be reopened. The buyer isn't notified automatically."
            confirmLabel="Cancel order"
            onConfirm={() => move("CANCELLED")}
            trigger={
              <Button
                variant="ghost"
                className="w-full text-destructive hover:text-destructive"
                disabled={change.isPending}
              >
                Cancel order
              </Button>
            }
          />
        )}
        {order.status === "CANCELLED" && order.stockRestoredAt && (
          <p className="text-xs text-muted-foreground">
            Stock returned {formatDateTime(order.stockRestoredAt)}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: order, isLoading, isError, error } = useOrder(id);
  const { data: settings } = useSettings();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }
  if (isError || !order) return <p className="text-destructive">{errorMessage(error)}</p>;

  const a = order.shippingAddress;
  const chat = whatsappLink(
    a.phone,
    renderOrderMessage(settings?.orderConfirmationTemplate ?? "", {
      name: a.name.split(" ")[0] ?? a.name,
      orderNumber: order.orderNumber,
      total: formatPaise(order.total, settings?.currency),
      items: order.items
        .map((i, n) => {
          const v = variantLabel(i.size, i.colour);
          return `${n + 1}. ${i.title}${v ? ` (${v})` : ""} × ${i.quantity}`;
        })
        .join("\n"),
      storeName: settings?.storeName ?? "",
      amountDue: formatPaise(Math.max(0, order.total - order.amountReceived), settings?.currency),
    }),
  );

  return (
    <>
      <Link
        href="/admin/orders"
        className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Orders
      </Link>
      <PageHeader
        title={order.orderNumber}
        description={`Placed ${formatDateTime(order.createdAt)}`}
        actions={
          <>
            {chat && (
              <Button variant="outline" asChild>
                <a href={chat} target="_blank" rel="noreferrer">
                  <MessageCircle className="size-4" aria-hidden />
                  WhatsApp
                </a>
              </Button>
            )}
            <Button variant="outline" asChild>
              <a href={`/admin/orders/${order.id}/print?doc=slip`} target="_blank">
                <Package className="size-4" aria-hidden />
                Packing slip
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={`/admin/orders/${order.id}/print`} target="_blank">
                <Printer className="size-4" aria-hidden />
                Invoice
              </a>
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Items <span className="font-normal text-muted-foreground">· {order.itemCount}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {order.items.map((i) => (
                  <li key={i.variantId} className="flex gap-4 py-3 first:pt-0 text-sm">
                    <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded bg-muted">
                      {i.imageKey && (
                        <Image
                          src={imageUrl(i.imageKey)}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/products/${i.productId}`}
                        className="font-medium hover:underline"
                      >
                        {i.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {[variantLabel(i.size, i.colour), i.sku && `SKU ${i.sku}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                        {i.quantity} × {formatPaise(i.unitPrice)}
                      </p>
                    </div>
                    <p className="tabular-nums">{formatPaise(i.lineTotal)}</p>
                  </li>
                ))}
              </ul>
              <div className="mt-2 space-y-1 border-t pt-3 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatPaise(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{formatPaise(order.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 text-sm sm:grid-cols-2">
              <div>
                <h3 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Ship to
                </h3>
                <p>
                  {a.name}
                  <br />
                  {a.line1}
                  <br />
                  {a.city}
                  {a.state && `, ${a.state}`} – {a.pincode}
                  <br />
                  <a href={`tel:+91${a.phone}`} className="tabular-nums hover:underline">
                    {a.phone}
                  </a>
                </p>
                <Link
                  href={`/admin/customers/${order.customerId}`}
                  className="mt-2 inline-block text-xs underline underline-offset-2 hover:text-brand"
                >
                  View customer &amp; order history
                </Link>
              </div>
              {order.note && (
                <div>
                  <h3 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Buyer&apos;s note
                  </h3>
                  <p className="whitespace-pre-line">{order.note}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <StatusCard order={order} />
          <OrderDetailsForm key={order.id} order={order} />
        </div>
      </div>
    </>
  );
}

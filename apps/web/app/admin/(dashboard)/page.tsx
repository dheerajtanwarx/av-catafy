"use client";

import { formatPaise } from "@catafy/types";
import { AlertTriangle, Clock, Plus, Radio, Receipt } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { OrderStatusBadge } from "@/components/admin/order-badges";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/order-status";
import { useLive, useOrders, useProducts, useSettings } from "@/lib/queries";

function Stat({
  label,
  value,
  icon,
  href,
}: {
  label: string;
  value?: number;
  icon: ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Card className="transition-colors hover:bg-accent/40">
        <CardContent className="flex items-center gap-4">
          <div className="rounded-md bg-muted p-2.5 text-muted-foreground">{icon}</div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            {value === undefined ? (
              <Skeleton className="mt-1 h-7 w-10" />
            ) : (
              <p className="text-2xl font-semibold tabular-nums">{value}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function DashboardPage() {
  const products = useProducts({ limit: 100 });
  const pending = useOrders({ status: "PENDING", limit: 1 });
  const unpaid = useOrders({ paymentStatus: "UNPAID", limit: 1 });
  const recent = useOrders({ limit: 6 });
  const live = useLive();
  const lowStock = useSettings().data?.lowStockThreshold;
  const lowOrOut =
    lowStock === undefined
      ? undefined
      : products.data?.items.filter((p) => p.totalStock <= lowStock).length;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Today at a glance."
        actions={
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus className="size-4" aria-hidden />
              Add product
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Pending orders"
          value={pending.data?.total}
          icon={<Clock className="size-5" />}
          href="/admin/orders"
        />
        <Stat
          label="Unpaid orders"
          value={unpaid.data?.total}
          icon={<Receipt className="size-5" />}
          href="/admin/orders"
        />
        <Stat
          label="Visitors now"
          value={live.data?.visitors.length}
          icon={<Radio className="size-5" />}
          href="/admin/live"
        />
        <Stat
          label="Low or out of stock"
          value={lowOrOut}
          icon={<AlertTriangle className="size-5" />}
          href="/admin/products"
        />
      </div>

      <Card className="mt-6 gap-0 pb-0">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base">Recent orders</CardTitle>
          <Link href="/admin/orders" className="text-sm text-muted-foreground hover:underline">
            View all
          </Link>
        </CardHeader>
        {recent.isLoading ? (
          <Skeleton className="m-4 h-40" />
        ) : recent.data?.items.length === 0 ? (
          <p className="border-t px-6 py-8 text-center text-sm text-muted-foreground">
            No orders yet. Share your store link on WhatsApp to get started.
          </p>
        ) : (
          <ul className="divide-y border-t">
            {recent.data?.items.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/admin/orders/${o.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-3 text-sm hover:bg-accent/40"
                >
                  <span className="font-medium tabular-nums">{o.orderNumber}</span>
                  <span className="min-w-0 flex-1 truncate">{o.customerName}</span>
                  <span className="hidden text-muted-foreground sm:inline">
                    {formatDateTime(o.createdAt)}
                  </span>
                  <OrderStatusBadge status={o.status} />
                  <span className="w-24 text-right tabular-nums">{formatPaise(o.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

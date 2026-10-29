"use client";

import {
  formatPaise,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  type AdminOrderListQuery,
  type OrderStatus,
  type PaymentStatus,
} from "@catafy/types";
import { Receipt, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/order-badges";
import { PageHeader } from "@/components/admin/page-header";
import { Pager } from "@/components/admin/pager";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { errorMessage } from "@/lib/api";
import { formatDateTime, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/order-status";
import { useOrders } from "@/lib/queries";

const ALL = "all";

export default function OrdersPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OrderStatus | typeof ALL>(ALL);
  const [payment, setPayment] = useState<PaymentStatus | typeof ALL>(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim());

  const query: AdminOrderListQuery = {
    q: q || undefined,
    status: status === ALL ? undefined : status,
    paymentStatus: payment === ALL ? undefined : payment,
    from: from || undefined,
    to: to || undefined,
    page,
    limit: 20,
  };
  const { data, isLoading, isError, error, isFetching } = useOrders(query);
  const filtered = Boolean(q) || status !== ALL || payment !== ALL || Boolean(from || to);

  /** Every filter change goes back to page 1. */
  function filter<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setPage(1);
    };
  }

  function clearFilters() {
    setSearch("");
    setStatus(ALL);
    setPayment(ALL);
    setFrom("");
    setTo("");
    setPage(1);
  }

  return (
    <>
      <PageHeader
        title="Orders"
        description={data ? `${data.total} order${data.total === 1 ? "" : "s"}` : undefined}
      />

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:flex-wrap">
        <div className="relative flex-1 lg:min-w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => filter(setSearch)(e.target.value)}
            placeholder="Order number, name or phone"
            aria-label="Search orders"
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select value={status} onValueChange={(v) => filter(setStatus)(v as typeof status)}>
            <SelectTrigger className="w-full sm:w-36" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {ORDER_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {ORDER_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={payment} onValueChange={(v) => filter(setPayment)(v as typeof payment)}>
            <SelectTrigger className="w-full sm:w-36" aria-label="Filter by payment">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All payments</SelectItem>
              {PAYMENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {PAYMENT_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => filter(setFrom)(e.target.value)}
            aria-label="From date"
            className="sm:w-40"
          />
          <Input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => filter(setTo)(e.target.value)}
            aria-label="To date"
            className="sm:w-40"
          />
        </div>
        {filtered && (
          <Button variant="ghost" onClick={clearFilters} className="self-start">
            <X className="size-4" aria-hidden />
            Clear
          </Button>
        )}
      </div>

      <Card className="py-0">
        {isError ? (
          <p className="p-6 text-sm text-destructive">{errorMessage(error)}</p>
        ) : !isLoading && data?.items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <Receipt className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">
              {filtered ? "No orders match these filters" : "No orders yet"}
            </p>
            {!filtered && (
              <p className="max-w-sm text-sm text-muted-foreground">
                Share your store or a catalogue link on WhatsApp. Orders appear here as soon as
                buyers place them.
              </p>
            )}
          </div>
        ) : (
          <Table className={isFetching && !isLoading ? "opacity-70 transition-opacity" : undefined}>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden md:table-cell">Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="hidden pr-4 lg:table-cell">Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 6 }, (_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6} className="px-4">
                        <Skeleton className="h-10 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : data?.items.map((o) => (
                    <TableRow
                      key={o.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/admin/orders/${o.id}`)}
                    >
                      <TableCell className="pl-4">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="font-medium tabular-nums hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {o.orderNumber}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(o.createdAt)}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-[12rem]">
                        <p className="truncate">{o.customerName}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {o.phone} · {o.city}
                        </p>
                      </TableCell>
                      <TableCell className="hidden tabular-nums md:table-cell">
                        {o.itemCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPaise(o.total)}
                        <div className="mt-1 sm:hidden">
                          <OrderStatusBadge status={o.status} />
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <OrderStatusBadge status={o.status} />
                      </TableCell>
                      <TableCell className="hidden pr-4 lg:table-cell">
                        <PaymentStatusBadge status={o.paymentStatus} />
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {data && <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} />}
    </>
  );
}

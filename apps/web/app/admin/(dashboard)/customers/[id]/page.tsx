"use client";

import { formatPaise, type AdminCustomerDetail } from "@catafy/types";
import { ArrowLeft, Loader2, MessageCircle } from "lucide-react";
import Link from "next/link";
import { use, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/order-badges";
import { PageHeader } from "@/components/admin/page-header";
import { Pager } from "@/components/admin/pager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/order-status";
import { useCustomer, useOrders, useUpdateCustomer } from "@/lib/queries";
import { whatsappLink } from "@/lib/whatsapp";

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Card className="py-4">
      <CardContent className="px-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold tabular-nums">{children}</p>
      </CardContent>
    </Card>
  );
}

function NotesCard({ customer }: { customer: AdminCustomerDetail }) {
  const update = useUpdateCustomer(customer.id);
  const [notes, setNotes] = useState(customer.notes);
  const dirty = notes.trim() !== customer.notes;

  async function save() {
    try {
      const saved = await update.mutateAsync({ notes });
      setNotes(saved.notes);
      toast.success("Notes saved");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          placeholder="Sizes, preferences, payment habits… (only you can see these)"
          aria-label="Customer notes"
        />
        {dirty && (
          <Button size="sm" onClick={save} disabled={update.isPending}>
            {update.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Save notes
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function OrderHistory({ customerId }: { customerId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useOrders({ customerId, page, limit: 10 });

  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Orders</CardTitle>
      </CardHeader>
      {isLoading ? (
        <Skeleton className="m-4 h-32" />
      ) : (
        <ul className="divide-y border-t">
          {data?.items.map((o) => (
            <li key={o.id}>
              <Link
                href={`/admin/orders/${o.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-3 text-sm hover:bg-accent/40"
              >
                <span className="font-medium tabular-nums">{o.orderNumber}</span>
                <span className="text-muted-foreground">{formatDateTime(o.createdAt)}</span>
                <span className="ml-auto flex items-center gap-2">
                  <OrderStatusBadge status={o.status} />
                  <PaymentStatusBadge status={o.paymentStatus} />
                  <span className="w-24 text-right tabular-nums">{formatPaise(o.total)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {data && data.totalPages > 1 && (
        <div className="px-4 pb-4">
          <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} />
        </div>
      )}
    </Card>
  );
}

export default function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: c, isLoading, isError, error } = useCustomer(id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (isError || !c) return <p className="text-destructive">{errorMessage(error)}</p>;

  const chat = whatsappLink(c.phone, `Hi ${c.name.split(" ")[0]}, `);
  const a = c.lastAddress;

  return (
    <>
      <Link
        href="/admin/customers"
        className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Customers
      </Link>
      <PageHeader
        title={c.name}
        description={`${c.phone} · customer since ${formatDate(c.createdAt)}`}
        actions={
          chat && (
            <Button variant="outline" asChild>
              <a href={chat} target="_blank" rel="noreferrer">
                <MessageCircle className="size-4" aria-hidden />
                WhatsApp
              </a>
            </Button>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Orders">{c.orderCount}</Stat>
        <Stat label="Total spent">{formatPaise(c.totalSpent)}</Stat>
        <Stat label="Last order">{c.lastOrderAt ? formatDate(c.lastOrderAt) : "—"}</Stat>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <OrderHistory customerId={c.id} />
        </div>
        <div className="space-y-6">
          {a && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Last address</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                {a.line1}
                <br />
                {a.city}
                {a.state && `, ${a.state}`} – {a.pincode}
              </CardContent>
            </Card>
          )}
          <NotesCard key={c.id} customer={c} />
        </div>
      </div>
    </>
  );
}

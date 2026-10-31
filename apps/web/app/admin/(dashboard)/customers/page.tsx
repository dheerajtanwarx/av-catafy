"use client";

import { formatPaise } from "@catafy/types";
import { Search, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { Pager } from "@/components/admin/pager";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { formatDate } from "@/lib/order-status";
import { useCustomers } from "@/lib/queries";

export default function CustomersPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim());
  const { data, isLoading, isError, error, isFetching } = useCustomers({
    q: q || undefined,
    page,
    limit: 20,
  });

  return (
    <>
      <PageHeader
        title="Customers"
        description="Created automatically from orders, one per phone number."
      />

      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Name or phone"
          aria-label="Search customers"
          className="pl-9"
        />
      </div>

      <Card className="py-0">
        {isError ? (
          <p className="p-6 text-sm text-destructive">{errorMessage(error)}</p>
        ) : !isLoading && data?.items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <Users className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">{q ? "No customers match" : "No customers yet"}</p>
          </div>
        ) : (
          <Table className={isFetching && !isLoading ? "opacity-70 transition-opacity" : undefined}>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Customer</TableHead>
                <TableHead className="hidden sm:table-cell">City</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Total spent</TableHead>
                <TableHead className="hidden pr-4 md:table-cell">Last order</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 6 }, (_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5} className="px-4">
                        <Skeleton className="h-10 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : data?.items.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/admin/customers/${c.id}`)}
                    >
                      <TableCell className="pl-4">
                        <Link
                          href={`/admin/customers/${c.id}`}
                          className="font-medium hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.name}
                        </Link>
                        <p className="text-xs text-muted-foreground tabular-nums">{c.phone}</p>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {c.city || "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{c.orderCount}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPaise(c.totalSpent)}
                      </TableCell>
                      <TableCell className="hidden pr-4 text-muted-foreground md:table-cell">
                        {c.lastOrderAt ? formatDate(c.lastOrderAt) : "—"}
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

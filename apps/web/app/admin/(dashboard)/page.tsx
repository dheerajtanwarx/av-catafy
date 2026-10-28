"use client";

import { AlertTriangle, FolderTree, Plus, Shirt } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories, useProducts } from "@/lib/queries";

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
  const inactive = useProducts({ status: "inactive", limit: 1 });
  const categories = useCategories();
  const outOfStock = products.data?.items.filter((p) => p.totalStock === 0).length;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Orders and live visitors arrive in later phases."
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
          label="Products"
          value={products.data?.total}
          icon={<Shirt className="size-5" />}
          href="/admin/products"
        />
        <Stat
          label="Inactive products"
          value={inactive.data?.total}
          icon={<Shirt className="size-5" />}
          href="/admin/products"
        />
        <Stat
          label="Out of stock"
          value={outOfStock}
          icon={<AlertTriangle className="size-5" />}
          href="/admin/products"
        />
        <Stat
          label="Categories"
          value={categories.data?.length}
          icon={<FolderTree className="size-5" />}
          href="/admin/categories"
        />
      </div>
    </>
  );
}

"use client";

import { formatPaise, type AdminProductListQuery, type ProductDto } from "@catafy/types";
import { ImageOff, Pencil, Plus, Search, Shirt, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { PageHeader } from "@/components/admin/page-header";
import { Pager } from "@/components/admin/pager";
import { Badge } from "@/components/ui/badge";
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
import { imageUrl } from "@/lib/images";
import { useCategories, useDeleteProduct, useProducts } from "@/lib/queries";

// Replaced by the store's low-stock threshold setting in Phase 7.
const LOW_STOCK = 5;
const ALL = "all";

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) return <Badge variant="destructive">Out of stock</Badge>;
  if (stock <= LOW_STOCK)
    return <Badge className="bg-amber-100 text-amber-900">Low · {stock}</Badge>;
  return <span className="tabular-nums">{stock}</span>;
}

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<NonNullable<AdminProductListQuery["status"]>>("all");
  const [categoryId, setCategoryId] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim());

  const query: AdminProductListQuery = {
    q: q || undefined,
    status,
    categoryId: categoryId === ALL ? undefined : categoryId,
    page,
    limit: 20,
  };
  const { data, isLoading, isError, error, isFetching } = useProducts(query);
  const categories = useCategories();
  const categoryName = new Map(categories.data?.map((c) => [c.id, c.name]));
  const remove = useDeleteProduct();
  const filtered = Boolean(q) || status !== "all" || categoryId !== ALL;

  async function onDelete(p: ProductDto) {
    try {
      await remove.mutateAsync(p.id);
      toast.success(`Deleted “${p.title}”`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader
        title="Products"
        description={data ? `${data.total} product${data.total === 1 ? "" : "s"}` : undefined}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/admin/products/import">
                <Upload className="size-4" aria-hidden />
                Import
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/products/new">
                <Plus className="size-4" aria-hidden />
                Add product
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search title, tag or SKU"
            aria-label="Search products"
            className="pl-9"
          />
        </div>
        <Select
          value={categoryId}
          onValueChange={(v) => {
            setCategoryId(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-44" aria-label="Filter by category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {categories.data?.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as typeof status);
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-36" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="py-0">
        {isError ? (
          <p className="p-6 text-sm text-destructive">{errorMessage(error)}</p>
        ) : !isLoading && data?.items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <Shirt className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">
              {filtered ? "No products match these filters" : "No products yet"}
            </p>
            {!filtered && (
              <Button variant="outline" asChild>
                <Link href="/admin/products/new">Add your first product</Link>
              </Button>
            )}
          </div>
        ) : (
          <Table className={isFetching && !isLoading ? "opacity-70 transition-opacity" : undefined}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 pl-4">
                  <span className="sr-only">Image</span>
                </TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="hidden md:table-cell">Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead className="hidden sm:table-cell">Stock</TableHead>
                <TableHead className="hidden lg:table-cell">Status</TableHead>
                <TableHead className="w-24 pr-4">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }, (_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7} className="px-4">
                        <Skeleton className="h-12 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : data?.items.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="pl-4">
                        <div className="relative flex h-14 w-11 items-center justify-center overflow-hidden rounded bg-muted">
                          {p.images[0] ? (
                            <Image
                              src={imageUrl(p.images[0].key)}
                              alt=""
                              fill
                              sizes="44px"
                              className="object-cover"
                            />
                          ) : (
                            <ImageOff className="size-4 text-muted-foreground" aria-hidden />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[16rem]">
                        <Link
                          href={`/admin/products/${p.id}`}
                          className="font-medium hover:underline"
                        >
                          {p.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {p.variants.length} variant{p.variants.length === 1 ? "" : "s"}
                          {p.isFeatured && " · Featured"}
                        </p>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {p.categoryId ? (categoryName.get(p.categoryId) ?? "—") : "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatPaise(p.price)}
                        {p.mrp && p.mrp > p.price && (
                          <span className="ml-1.5 text-xs text-muted-foreground line-through">
                            {formatPaise(p.mrp)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <StockBadge stock={p.totalStock} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant={p.isActive ? "secondary" : "outline"}>
                          {p.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-4 text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/admin/products/${p.id}`} aria-label={`Edit ${p.title}`}>
                            <Pencil className="size-4" />
                          </Link>
                        </Button>
                        <ConfirmDialog
                          title={`Delete “${p.title}”?`}
                          description="It will be removed from the store and catalogues. Past orders keep their details."
                          onConfirm={() => onDelete(p)}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label={`Delete ${p.title}`}>
                              <Trash2 className="size-4" />
                            </Button>
                          }
                        />
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

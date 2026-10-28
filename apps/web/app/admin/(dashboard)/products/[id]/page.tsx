"use client";

import { ExternalLink } from "lucide-react";
import { use } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { ProductForm } from "@/components/admin/product-form";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { useProduct } from "@/lib/queries";

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, isError, error } = useProduct(id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }
  if (isError || !data) return <p className="text-destructive">{errorMessage(error)}</p>;

  return (
    <>
      <PageHeader
        title={data.title}
        description={`/p/${data.slug}`}
        actions={
          data.isActive ? (
            <a
              href={`/p/${data.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              View in store <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : undefined
        }
      />
      {/* key: remount the form when navigating between products */}
      <ProductForm key={data.id} product={data} />
    </>
  );
}

"use client";

import { use } from "react";
import { CatalogueForm } from "@/components/admin/catalogue-form";
import { PageHeader } from "@/components/admin/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { useCatalogue } from "@/lib/queries";

export default function EditCataloguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, isError, error } = useCatalogue(id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (isError || !data) return <p className="text-destructive">{errorMessage(error)}</p>;

  return (
    <>
      <PageHeader title={data.name} description={`/c/${data.slug}`} />
      <CatalogueForm key={data.id} catalogue={data} />
    </>
  );
}

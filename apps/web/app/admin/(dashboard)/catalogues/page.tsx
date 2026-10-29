"use client";

import type { CatalogueDto } from "@catafy/types";
import { BookOpen, ExternalLink, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { imageUrl } from "@/lib/images";
import { useCatalogues, useDeleteCatalogue } from "@/lib/queries";

export default function CataloguesPage() {
  const { data, isLoading, isError, error } = useCatalogues();
  const remove = useDeleteCatalogue();

  async function onDelete(c: CatalogueDto) {
    try {
      await remove.mutateAsync(c.id);
      toast.success(`Deleted “${c.name}”`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader
        title="Catalogues"
        description="Curated collections, each with its own link to share."
        actions={
          <Button asChild>
            <Link href="/admin/catalogues/new">
              <Plus className="size-4" aria-hidden />
              New catalogue
            </Link>
          </Button>
        }
      />
      {isError && <p className="text-sm text-destructive">{errorMessage(error)}</p>}
      {!isLoading && data?.length === 0 && (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <BookOpen className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">No catalogues yet</p>
          <p className="text-sm text-muted-foreground">
            Group products like “Diwali Collection” and share one link.
          </p>
          <Button variant="outline" asChild>
            <Link href="/admin/catalogues/new">New catalogue</Link>
          </Button>
        </Card>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading &&
          Array.from({ length: 3 }, (_, i) => (
            <li key={i}>
              <Skeleton className="h-56 w-full" />
            </li>
          ))}
        {data?.map((c) => (
          <li key={c.id}>
            <Card className="gap-0 overflow-hidden py-0">
              <Link href={`/admin/catalogues/${c.id}`} className="block">
                <div className="relative aspect-[16/9] bg-muted">
                  {c.coverImage && (
                    <Image
                      src={imageUrl(c.coverImage.key)}
                      alt=""
                      fill
                      sizes="(min-width: 640px) 33vw, 100vw"
                      className="object-cover"
                    />
                  )}
                </div>
              </Link>
              <div className="flex items-start justify-between gap-2 p-4">
                <div className="min-w-0">
                  <Link href={`/admin/catalogues/${c.id}`} className="font-medium hover:underline">
                    {c.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {c.productCount} product{c.productCount === 1 ? "" : "s"} · /c/{c.slug}
                  </p>
                  {(!c.isActive || c.isPrivate || c.hidePrices) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {!c.isActive && <Badge variant="outline">Inactive</Badge>}
                      {c.isPrivate && <Badge variant="secondary">Private</Badge>}
                      {!c.isPrivate && c.hidePrices && (
                        <Badge variant="secondary">Price on request</Badge>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0">
                  {c.isActive && (
                    <Button variant="ghost" size="icon" asChild>
                      <a
                        href={`/c/${c.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open ${c.name} in store`}
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    </Button>
                  )}
                  <ConfirmDialog
                    title={`Delete “${c.name}”?`}
                    description="The shared link will stop working. Products are not deleted."
                    onConfirm={() => onDelete(c)}
                    trigger={
                      <Button variant="ghost" size="icon" aria-label={`Delete ${c.name}`}>
                        <Trash2 className="size-4" />
                      </Button>
                    }
                  />
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}

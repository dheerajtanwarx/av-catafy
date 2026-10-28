"use client";

import type { CategoryDto } from "@catafy/types";
import { FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import { CategoryDialog } from "@/components/admin/category-dialog";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { errorMessage } from "@/lib/api";
import { imageUrl } from "@/lib/images";
import { useCategories, useDeleteCategory } from "@/lib/queries";

export default function CategoriesPage() {
  const { data, isLoading, isError, error } = useCategories();
  const remove = useDeleteCategory();
  const [editing, setEditing] = useState<CategoryDto | null>(null);
  const [open, setOpen] = useState(false);

  function openDialog(category: CategoryDto | null) {
    setEditing(category);
    setOpen(true);
  }

  async function onDelete(c: CategoryDto) {
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
        title="Categories"
        description="Group products for browsing and filtering."
        actions={
          <Button onClick={() => openDialog(null)}>
            <Plus className="size-4" aria-hidden />
            New category
          </Button>
        }
      />

      <Card className="py-0">
        {isError ? (
          <p className="p-6 text-sm text-destructive">{errorMessage(error)}</p>
        ) : !isLoading && data?.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <FolderTree className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">No categories yet</p>
            <p className="text-sm text-muted-foreground">
              Create one, e.g. Kurtis, Sarees or Co-ord sets.
            </p>
            <Button variant="outline" onClick={() => openDialog(null)}>
              New category
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 pl-4">
                  <span className="sr-only">Image</span>
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Products</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="w-24 pr-4 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 3 }, (_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5} className="px-4">
                        <Skeleton className="h-10 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : data?.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="pl-4">
                        <div className="relative size-10 overflow-hidden rounded bg-muted">
                          {c.image && (
                            <Image
                              src={imageUrl(c.image.key)}
                              alt=""
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">/{c.slug}</p>
                      </TableCell>
                      <TableCell className="hidden tabular-nums sm:table-cell">
                        {c.productCount}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant={c.isActive ? "secondary" : "outline"}>
                          {c.isActive ? "Active" : "Hidden"}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDialog(c)}
                          aria-label={`Edit ${c.name}`}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <ConfirmDialog
                          title={`Delete “${c.name}”?`}
                          description={
                            c.productCount > 0
                              ? `This category has ${c.productCount} product(s). Move them to another category first.`
                              : "This cannot be undone."
                          }
                          onConfirm={() => onDelete(c)}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label={`Delete ${c.name}`}>
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

      <CategoryDialog open={open} onOpenChange={setOpen} category={editing} />
    </>
  );
}

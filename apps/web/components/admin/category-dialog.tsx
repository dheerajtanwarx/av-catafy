"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { categoryInputSchema, type CategoryDto, type CategoryInput } from "@catafy/types";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/api";
import { useSaveCategory } from "@/lib/queries";
import { ImageField } from "./image-field";

type Parsed = z.output<typeof categoryInputSchema>;

function toFormValues(c?: CategoryDto | null): CategoryInput {
  return {
    name: c?.name ?? "",
    slug: c?.slug ?? "",
    description: c?.description ?? "",
    image: c?.image ?? null,
    sortOrder: c?.sortOrder ?? 0,
    isActive: c?.isActive ?? true,
  };
}

export function CategoryDialog({
  open,
  onOpenChange,
  category,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: CategoryDto | null;
}) {
  const save = useSaveCategory();
  const form = useForm<CategoryInput, unknown, Parsed>({
    resolver: zodResolver(categoryInputSchema),
    defaultValues: toFormValues(category),
  });

  useEffect(() => {
    if (open) form.reset(toFormValues(category));
  }, [open, category, form]);

  async function onSubmit(values: Parsed) {
    try {
      await save.mutateAsync({ id: category?.id, input: values });
      toast.success(category ? "Category saved" : "Category created");
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{category ? "Edit category" : "New category"}</DialogTitle>
          <DialogDescription>Categories appear as tiles on the store home page.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id="category-form"
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Kurtis" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL slug</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Generated from name"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sortOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        value={Number.isNaN(field.value) ? "" : field.value}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? 0 : e.target.valueAsNumber)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="image"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image</FormLabel>
                  <ImageField
                    value={field.value ?? null}
                    onChange={field.onChange}
                    folder="categories"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-4">
                  <div>
                    <FormLabel>Active</FormLabel>
                    <FormDescription>Hidden from the store when off.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="category-form" disabled={save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

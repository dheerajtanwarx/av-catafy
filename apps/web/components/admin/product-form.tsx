"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  PRODUCT_MAX_IMAGES,
  productInputSchema,
  type ProductDto,
  type ProductInput,
  type ProductInputParsed,
} from "@catafy/types";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, errorMessage } from "@/lib/api";
import { useCategories, useSaveProduct } from "@/lib/queries";
import { ImageGallery } from "./image-gallery";
import { MoneyInput } from "./money-input";
import { TagInput } from "./tag-input";
import { VariantsEditor } from "./variants-editor";

const NO_CATEGORY = "none";

function toFormValues(p?: ProductDto): ProductInput {
  if (!p) {
    return {
      title: "",
      slug: "",
      description: "",
      categoryId: null,
      tags: [],
      price: NaN,
      mrp: null,
      fabric: "",
      care: "",
      isActive: true,
      isFeatured: false,
      moq: 1,
      packSize: null,
      images: [],
      variants: [{ size: "Free size", colour: "Default", sku: "", stock: 0 }],
    };
  }
  return {
    title: p.title,
    slug: p.slug,
    description: p.description,
    categoryId: p.categoryId,
    tags: p.tags,
    price: p.price,
    mrp: p.mrp,
    fabric: p.fabric,
    care: p.care,
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    moq: p.moq,
    packSize: p.packSize,
    images: p.images,
    variants: p.variants.map((v) => ({
      id: v.id,
      size: v.size,
      colour: v.colour,
      sku: v.sku ?? "",
      stock: v.stock,
    })),
  };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

export function ProductForm({ product }: { product?: ProductDto }) {
  const router = useRouter();
  const categories = useCategories();
  const save = useSaveProduct();
  const form = useForm<ProductInput, unknown, ProductInputParsed>({
    resolver: zodResolver(productInputSchema),
    defaultValues: toFormValues(product),
  });
  const { isDirty } = form.formState;

  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  async function onSubmit(values: ProductInputParsed) {
    try {
      const saved = await save.mutateAsync({ id: product?.id, input: values });
      form.reset(toFormValues(saved));
      toast.success(product ? "Product saved" : "Product created");
      if (!product) router.replace(`/admin/products/${saved.id}`);
    } catch (err) {
      // Map server-side field errors back onto the form.
      if (err instanceof ApiError && err.code === "VALIDATION_ERROR") {
        const fieldErrors =
          (err.details as { fieldErrors?: Record<string, string[]> })?.fieldErrors ?? {};
        for (const [field, messages] of Object.entries(fieldErrors)) {
          form.setError(field as FieldPath<ProductInput>, { message: messages[0] });
        }
      }
      toast.error(errorMessage(err));
    }
  }

  const numberField = (name: "moq" | "packSize", nullable: boolean) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{name === "moq" ? "Minimum order quantity" : "Pieces per set"}</FormLabel>
          <FormControl>
            <Input
              type="number"
              min={1}
              inputMode="numeric"
              placeholder={nullable ? "Sold individually" : undefined}
              {...field}
              value={field.value === null || Number.isNaN(field.value) ? "" : field.value}
              onChange={(e) =>
                field.onChange(
                  e.target.value === "" ? (nullable ? null : NaN) : e.target.valueAsNumber,
                )
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="pb-24">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-6">
            <Section title="Details">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Chikankari cotton kurti" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea rows={5} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="fabric"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fabric</FormLabel>
                      <FormControl>
                        <Input placeholder="Pure cotton" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL slug</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Generated from title"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="care"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Care instructions</FormLabel>
                    <FormControl>
                      <Textarea rows={2} placeholder="Gentle hand wash, dry in shade" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Section>

            <Section title="Images">
              <FormField
                control={form.control}
                name="images"
                render={({ field }) => (
                  <FormItem>
                    <ImageGallery
                      value={field.value ?? []}
                      onChange={field.onChange}
                      max={PRODUCT_MAX_IMAGES}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Section>

            <Section title="Variants & stock">
              <VariantsEditor />
            </Section>
          </div>

          <div className="space-y-6">
            <Section title="Visibility">
              {(["isActive", "isFeatured"] as const).map((name) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-4">
                      <div>
                        <FormLabel>{name === "isActive" ? "Active" : "Featured"}</FormLabel>
                        <FormDescription>
                          {name === "isActive" ? "Visible in the store" : "Shown on the home page"}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              ))}
            </Section>

            <Section title="Pricing">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price</FormLabel>
                    <FormControl>
                      <MoneyInput
                        value={Number.isNaN(field.value) ? null : field.value}
                        onChange={(v) => field.onChange(v ?? NaN)}
                        onBlur={field.onBlur}
                        name={field.name}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mrp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MRP (optional)</FormLabel>
                    <FormControl>
                      <MoneyInput
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                      />
                    </FormControl>
                    <FormDescription>Shown struck through with the discount %.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Section>

            <Section title="Organisation">
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      value={field.value ?? NO_CATEGORY}
                      onValueChange={(v) => field.onChange(v === NO_CATEGORY ? null : v)}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="No category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_CATEGORY}>No category</SelectItem>
                        {categories.data?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <FormControl>
                      <TagInput value={field.value ?? []} onChange={field.onChange} />
                    </FormControl>
                    <FormDescription>Used for search, e.g. cotton, festive.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Section>

            <Section title="Ordering">
              {numberField("moq", false)}
              {numberField("packSize", true)}
            </Section>
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-4 py-3 backdrop-blur md:left-[240px] md:px-8">
          <div className="flex items-center justify-end gap-2">
            {isDirty && (
              <span className="mr-auto text-sm text-muted-foreground">Unsaved changes</span>
            )}
            <Button variant="ghost" asChild>
              <Link href="/admin/products">Cancel</Link>
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {product ? "Save changes" : "Create product"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}

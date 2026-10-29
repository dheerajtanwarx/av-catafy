"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  catalogueInputSchema,
  type CatalogueDetailDto,
  type CatalogueInput,
  type CatalogueInputParsed,
} from "@catafy/types";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useForm, useFormContext } from "react-hook-form";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/api";
import { useSaveCatalogue } from "@/lib/queries";
import { CatalogueProducts, type ProductSummaries } from "./catalogue-products";
import { ImageField } from "./image-field";
import { ShareLink } from "./share-link";

function toFormValues(c?: CatalogueDetailDto): CatalogueInput {
  return {
    name: c?.name ?? "",
    slug: c?.slug ?? "",
    description: c?.description ?? "",
    coverImage: c?.coverImage ?? null,
    productIds: c?.products.map((p) => p.id) ?? [],
    isActive: c?.isActive ?? true,
    sortOrder: c?.sortOrder ?? 0,
    isPrivate: c?.isPrivate ?? false,
    hidePrices: c?.hidePrices ?? false,
    // Pre-filled so the owner can see and re-share it; saving it unchanged revokes nobody.
    passcode: c?.passcode ?? "",
  };
}

type Access = "public" | "prices" | "private";

const ACCESS_HELP: Record<Access, string> = {
  public: "Anyone with the link can browse and order.",
  prices: "Anyone can browse. Prices and ordering need the passcode.",
  private:
    "Hidden until the passcode is entered. Its products disappear from the rest of the store unless they're also in a public catalogue.",
};

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

export function CatalogueForm({ catalogue }: { catalogue?: CatalogueDetailDto }) {
  const router = useRouter();
  const save = useSaveCatalogue();
  const [summaries, setSummaries] = useState<ProductSummaries>(() =>
    Object.fromEntries((catalogue?.products ?? []).map((p) => [p.id, p])),
  );
  const form = useForm<CatalogueInput, unknown, CatalogueInputParsed>({
    resolver: zodResolver(catalogueInputSchema),
    defaultValues: toFormValues(catalogue),
  });
  const { isDirty } = form.formState;

  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  async function onSubmit(values: CatalogueInputParsed) {
    if ((values.isPrivate || values.hidePrices) && !values.passcode) {
      form.setError("passcode", { message: "Set a passcode buyers will enter" });
      return;
    }
    try {
      const saved = await save.mutateAsync({ id: catalogue?.id, input: values });
      form.reset(toFormValues(saved));
      toast.success(catalogue ? "Catalogue saved" : "Catalogue created");
      if (!catalogue) router.replace(`/admin/catalogues/${saved.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="pb-24">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-6">
            <Section title="Details">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Diwali Collection" {...field} />
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
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="coverImage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cover image</FormLabel>
                    <ImageField
                      value={field.value ?? null}
                      onChange={field.onChange}
                      folder="catalogues"
                    />
                    <FormDescription>
                      Optional. The first product image is used otherwise.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Section>

            <Section title="Products">
              <FormField
                control={form.control}
                name="productIds"
                render={({ field }) => (
                  <FormItem>
                    <CatalogueProducts
                      value={field.value ?? []}
                      onChange={(ids) => field.onChange(ids)}
                      summaries={summaries}
                      onSummaries={setSummaries}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Section>
          </div>

          <div className="space-y-6">
            {catalogue && catalogue.isActive && (
              <Section title="Share">
                <ShareLink path={`/c/${catalogue.slug}`} text={catalogue.name} />
              </Section>
            )}
            <Section title="Visibility">
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-4">
                    <div>
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        The link works and it shows on the home page.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <AccessFields />
            </Section>
            <Section title="Link & order">
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
                    <FormDescription>
                      Changing it breaks links you have already shared.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sortOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Position on home page</FormLabel>
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
                    <FormDescription>Lower numbers show first.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Section>
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-4 py-3 backdrop-blur md:left-[240px] md:px-8">
          <div className="flex items-center justify-end gap-2">
            {isDirty && (
              <span className="mr-auto text-sm text-muted-foreground">Unsaved changes</span>
            )}
            <Button variant="ghost" asChild>
              <Link href="/admin/catalogues">Cancel</Link>
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {catalogue ? "Save changes" : "Create catalogue"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}

function AccessFields() {
  const form = useFormContext<CatalogueInput, unknown, CatalogueInputParsed>();
  const [isPrivate, hidePrices] = form.watch(["isPrivate", "hidePrices"]);
  const access: Access = isPrivate ? "private" : hidePrices ? "prices" : "public";

  function setAccess(next: Access) {
    form.setValue("isPrivate", next === "private", { shouldDirty: true });
    form.setValue("hidePrices", next === "prices", { shouldDirty: true });
  }

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="catalogue-access">Access</Label>
        <Select value={access} onValueChange={(v) => setAccess(v as Access)}>
          <SelectTrigger id="catalogue-access" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="public">Public</SelectItem>
            <SelectItem value="prices">Price on request</SelectItem>
            <SelectItem value="private">Private</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">{ACCESS_HELP[access]}</p>
      </div>
      {access !== "public" && (
        <FormField
          control={form.control}
          name="passcode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Passcode</FormLabel>
              <FormControl>
                <Input
                  autoComplete="off"
                  placeholder="e.g. DIWALI24"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormDescription>
                Share it with buyers along with the link. Not case-sensitive. Changing it locks out
                everyone who used the old one.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </>
  );
}

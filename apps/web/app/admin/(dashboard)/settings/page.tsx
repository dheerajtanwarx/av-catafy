"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ORDER_MESSAGE_PLACEHOLDERS,
  storeSettingsInputSchema,
  type StoreSettingsDto,
  type StoreSettingsInput,
  type StoreSettingsInputParsed,
} from "@catafy/types";
import { Loader2 } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ImageField } from "@/components/admin/image-field";
import { PageHeader } from "@/components/admin/page-header";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/api";
import { useSaveSettings, useSettings } from "@/lib/queries";

function toFormValues({ updatedAt: _updatedAt, ...s }: StoreSettingsDto): StoreSettingsInput {
  return s;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

const SOCIAL = [
  { name: "socialLinks.instagram", label: "Instagram" },
  { name: "socialLinks.facebook", label: "Facebook" },
  { name: "socialLinks.youtube", label: "YouTube" },
  { name: "socialLinks.website", label: "Website" },
] as const;

function SettingsForm({ settings }: { settings: StoreSettingsDto }) {
  const save = useSaveSettings();
  const form = useForm<StoreSettingsInput, unknown, StoreSettingsInputParsed>({
    resolver: zodResolver(storeSettingsInputSchema),
    defaultValues: toFormValues(settings),
  });
  const { isDirty } = form.formState;

  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  async function onSubmit(values: StoreSettingsInputParsed) {
    try {
      form.reset(toFormValues(await save.mutateAsync(values)));
      toast.success("Settings saved. The store updates right away.");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const text = (
    name: "storeName" | "whatsappNumber" | "currency" | "gstin",
    label: string,
    description?: string,
    props: React.ComponentProps<typeof Input> = {},
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input {...props} {...field} value={field.value ?? ""} />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="pb-24">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Section title="Store">
              {text("storeName", "Store name")}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Short description</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormDescription>Shown on the home page and in link previews.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="logo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logo</FormLabel>
                    <ImageField
                      value={field.value ?? null}
                      onChange={field.onChange}
                      folder="store"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="banner"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Home page banner</FormLabel>
                    <ImageField
                      value={field.value ?? null}
                      onChange={field.onChange}
                      folder="store"
                    />
                    <FormDescription>Wide image, at least 1600px across.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="accentColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Accent colour</FormLabel>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                        aria-label="Pick accent colour"
                        className="size-10 shrink-0 cursor-pointer rounded border bg-transparent p-0.5"
                      />
                      <FormControl>
                        <Input {...field} className="w-32 font-mono" />
                      </FormControl>
                    </div>
                    <FormDescription>Used for buttons, badges and highlights.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Section>

            <Section title="Contact">
              {text(
                "whatsappNumber",
                "WhatsApp number",
                "Buyers send their orders here. 10-digit Indian numbers get +91 automatically.",
                { inputMode: "tel", placeholder: "98765 43210" },
              )}
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormDescription>Shown in the footer and on invoices.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {SOCIAL.map((s) => (
                <FormField
                  key={s.name}
                  control={form.control}
                  name={s.name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{s.label}</FormLabel>
                      <FormControl>
                        <Input type="url" placeholder="https://" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </Section>
          </div>

          <div className="space-y-6">
            <Section title="Orders">
              <FormField
                control={form.control}
                name="orderConfirmationTemplate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order confirmation message</FormLabel>
                    <FormControl>
                      <Textarea rows={4} {...field} />
                    </FormControl>
                    <FormDescription>
                      Pre-filled when you WhatsApp a buyer from an order. You can use{" "}
                      {ORDER_MESSAGE_PLACEHOLDERS.map((p, i) => (
                        <span key={p}>
                          {i > 0 && ", "}
                          <code className="rounded bg-muted px-1 text-xs">{`{{${p}}}`}</code>
                        </span>
                      ))}
                      .
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lowStockThreshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Low-stock alert</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        className="w-32"
                        {...field}
                        value={Number.isNaN(field.value) ? "" : (field.value ?? "")}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? 0 : e.target.valueAsNumber)
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      Products at or below this many pieces are flagged in the admin.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {text("currency", "Currency", "3-letter code. Prices are shown in this currency.", {
                className: "w-32 uppercase",
                maxLength: 3,
              })}
            </Section>

            <Section
              title="Invoices"
              description="No tax is calculated; these only change what invoices print."
            >
              {text("gstin", "GSTIN", "Leave blank if you're not GST-registered.", {
                className: "font-mono uppercase",
                maxLength: 15,
              })}
              <FormField
                control={form.control}
                name="showTaxInclusive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-4">
                    <div>
                      <FormLabel>Prices include tax</FormLabel>
                      <FormDescription>
                        Adds “All prices are inclusive of applicable taxes” to invoices.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </Section>
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-4 py-3 backdrop-blur md:left-[240px] md:px-8">
          <div className="flex items-center justify-end gap-2">
            {isDirty && (
              <>
                <span className="mr-auto text-sm text-muted-foreground">Unsaved changes</span>
                <Button type="button" variant="ghost" onClick={() => form.reset()}>
                  Discard
                </Button>
              </>
            )}
            <Button type="submit" disabled={save.isPending || !isDirty}>
              {save.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Save settings
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}

export default function SettingsPage() {
  const { data, isLoading, isError, error } = useSettings();
  return (
    <>
      <PageHeader title="Settings" description="Your store's details, look and order defaults." />
      {isLoading ? (
        <Skeleton className="h-96" />
      ) : isError || !data ? (
        <p className="text-destructive">{errorMessage(error)}</p>
      ) : (
        <SettingsForm key={data.updatedAt} settings={data} />
      )}
    </>
  );
}

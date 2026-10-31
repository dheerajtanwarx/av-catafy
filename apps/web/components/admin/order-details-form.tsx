"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  formatPaise,
  orderDetailsSchema,
  paymentStatusFor,
  type AdminOrderDetail,
  type OrderDetailsInput,
} from "@catafy/types";
import { Loader2 } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useForm } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/api";
import { useUpdateOrder } from "@/lib/queries";
import { MoneyInput } from "./money-input";
import { PaymentStatusBadge } from "./order-badges";

function toFormValues(o: AdminOrderDetail): OrderDetailsInput {
  return {
    amountReceived: o.amountReceived,
    paymentNotes: o.paymentNotes,
    courier: o.courier,
    trackingNumber: o.trackingNumber,
    internalNotes: o.internalNotes,
  };
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

/** Payment received, shipping and internal notes. Saves only the fields that changed. */
export function OrderDetailsForm({ order }: { order: AdminOrderDetail }) {
  const update = useUpdateOrder(order.id);
  const form = useForm<OrderDetailsInput>({
    resolver: zodResolver(orderDetailsSchema),
    defaultValues: toFormValues(order),
  });
  const { isDirty, dirtyFields } = form.formState;
  const amount = form.watch("amountReceived");
  const balance = order.total - (amount ?? 0);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  async function onSubmit(values: OrderDetailsInput) {
    const changed = Object.fromEntries(
      Object.entries(values).filter(([k]) => dirtyFields[k as keyof OrderDetailsInput]),
    );
    try {
      const saved = await update.mutateAsync(changed);
      form.reset(toFormValues(saved));
      toast.success("Order saved");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
        <Section
          title="Payment"
          action={<PaymentStatusBadge status={paymentStatusFor(amount ?? 0, order.total)} />}
        >
          <FormField
            control={form.control}
            name="amountReceived"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between gap-2">
                  <FormLabel>Amount received</FormLabel>
                  {balance > 0 && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                      onClick={() =>
                        form.setValue("amountReceived", order.total, { shouldDirty: true })
                      }
                    >
                      Mark fully paid
                    </Button>
                  )}
                </div>
                <FormControl>
                  <MoneyInput
                    value={field.value}
                    onChange={(v) => field.onChange(v ?? 0)}
                    onBlur={field.onBlur}
                    aria-label="Amount received in rupees"
                  />
                </FormControl>
                <FormDescription>
                  Order total {formatPaise(order.total)}
                  {balance > 0 && ` · ${formatPaise(balance)} due`}
                  {balance < 0 && ` · ${formatPaise(-balance)} over`}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="paymentNotes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment notes</FormLabel>
                <FormControl>
                  <Textarea rows={2} placeholder="UPI ref, COD, bank transfer…" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        <Section title="Shipping">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <FormField
              control={form.control}
              name="courier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Courier</FormLabel>
                  <FormControl>
                    <Input placeholder="Delhivery, India Post…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="trackingNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tracking number</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Section>

        <Section title="Internal notes">
          <FormField
            control={form.control}
            name="internalNotes"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea rows={3} placeholder="Only you can see these" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        {isDirty && (
          <div className="sticky bottom-4 flex justify-end gap-2 rounded-lg border bg-background/95 p-3 shadow-sm backdrop-blur">
            <Button type="button" variant="ghost" onClick={() => form.reset(toFormValues(order))}>
              Discard
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Save changes
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}

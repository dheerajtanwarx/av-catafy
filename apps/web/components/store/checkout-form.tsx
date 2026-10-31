"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { checkoutInputSchema, formatPaise } from "@catafy/types";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, errorMessage } from "@/lib/api";
import { cart, useCart } from "@/lib/cart";
import { imageUrl } from "@/lib/images";
import { variantLabel } from "@/lib/order-message";
import { useCartQuote } from "@/lib/use-cart-quote";

const formSchema = checkoutInputSchema.pick({ customer: true, note: true });
type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

// Remembered on this device only, so repeat buyers don't retype their address.
const BUYER_KEY = "catafy-buyer-v1";
const EMPTY: FormInput = {
  customer: { name: "", phone: "", line1: "", city: "", state: "", pincode: "" },
  note: "",
};

function savedBuyer(): FormInput {
  try {
    const saved = JSON.parse(localStorage.getItem(BUYER_KEY) ?? "null") as
      FormInput["customer"] | null;
    return saved ? { customer: { ...EMPTY.customer, ...saved }, note: "" } : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function CheckoutForm({ currency }: { currency: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const lines = useCart();
  const quote = useCartQuote(lines);
  const placed = useRef(false);
  const [hydrated, setHydrated] = useState(false);
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    form.reset(savedBuyer());
    setHydrated(true);
  }, [form]);

  useEffect(() => {
    if (hydrated && lines.length === 0 && !placed.current) router.replace("/cart");
  }, [hydrated, lines.length, router]);

  async function onSubmit(values: FormOutput) {
    try {
      const { token } = await api<{ orderNumber: string; token: string }>("/public/orders", {
        method: "POST",
        body: {
          ...values,
          items: lines.map(({ productId, variantId, quantity }) => ({
            productId,
            variantId,
            quantity,
          })),
        },
      });
      placed.current = true;
      try {
        localStorage.setItem(BUYER_KEY, JSON.stringify(values.customer));
      } catch {
        // ignore
      }
      cart.clear();
      router.replace(`/order/${token}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "OUT_OF_STOCK") {
        await queryClient.invalidateQueries({ queryKey: ["cart-quote"] });
        toast.error(err.message);
        router.push("/cart");
        return;
      }
      toast.error(errorMessage(err));
    }
  }

  const field = (
    name:
      | "customer.name"
      | "customer.phone"
      | "customer.line1"
      | "customer.city"
      | "customer.state"
      | "customer.pincode",
    label: string,
    props: React.ComponentProps<typeof Input> = {},
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field: f }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input className="h-11" {...props} {...f} value={f.value ?? ""} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const submitting = form.formState.isSubmitting;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
          <h2 className="font-display text-2xl">Delivery details</h2>
          {field("customer.name", "Full name", { autoComplete: "name" })}
          {field("customer.phone", "Mobile number", {
            type: "tel",
            inputMode: "tel",
            autoComplete: "tel",
            placeholder: "10-digit mobile number",
          })}
          {field("customer.line1", "Address", {
            autoComplete: "street-address",
            placeholder: "House no., street, area, landmark",
          })}
          <div className="grid grid-cols-2 gap-4">
            {field("customer.city", "City", { autoComplete: "address-level2" })}
            {field("customer.pincode", "Pincode", {
              inputMode: "numeric",
              autoComplete: "postal-code",
              maxLength: 6,
            })}
          </div>
          {field("customer.state", "State (optional)", { autoComplete: "address-level1" })}
          <FormField
            control={form.control}
            name="note"
            render={({ field: f }) => (
              <FormItem>
                <FormLabel>Note for the store (optional)</FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    placeholder="Preferred delivery time, gift wrap…"
                    {...f}
                    value={f.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            size="lg"
            className="h-12 w-full rounded-full text-base"
            disabled={submitting || !quote.data?.orderable}
          >
            {submitting ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <Lock className="size-4" aria-hidden />
            )}
            Place order{quote.data ? ` · ${formatPaise(quote.data.total, currency)}` : ""}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            No payment now. We&apos;ll confirm availability and share payment details (UPI, bank
            transfer or COD) on WhatsApp.
          </p>
        </form>
      </Form>

      <aside className="h-fit rounded-sm bg-muted/60 p-6 lg:sticky lg:top-24">
        <h2 className="mb-4 font-display text-2xl">Your order</h2>
        {!quote.data ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            <ul className="space-y-4">
              {quote.data.lines.map((l) => (
                <li key={l.variantId} className="flex gap-3 text-sm">
                  <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-sm bg-muted">
                    {l.image && (
                      <Image
                        src={imageUrl(l.image.key)}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    )}
                    <span className="absolute -top-0 -right-0 rounded-bl bg-foreground px-1.5 text-[10px] text-background">
                      {l.quantity}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2">{l.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {variantLabel(l.size, l.colour)}
                    </p>
                  </div>
                  <p className="tabular-nums">{formatPaise(l.lineTotal, currency)}</p>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex justify-between border-t pt-4 font-medium">
              <span>Total</span>
              <span className="tabular-nums">{formatPaise(quote.data.total, currency)}</span>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

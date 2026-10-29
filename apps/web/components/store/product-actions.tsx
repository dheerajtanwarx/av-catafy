"use client";

import { formatPaise, type PublicProduct } from "@catafy/types";
import { MessageCircle, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { cart } from "@/lib/cart";
import { variantLabel } from "@/lib/order-message";
import { whatsappLink } from "@/lib/whatsapp";
import { QuantityStepper } from "./quantity-stepper";
import { UnlockForm } from "./unlock-form";
import { findVariant, VariantPicker } from "./variant-picker";

const LOW_STOCK = 3;

function initialSelection(product: PublicProduct) {
  const firstInStock = product.variants.find((v) => v.stock > 0) ?? product.variants[0] ?? null;
  const sizes = new Set(product.variants.map((v) => v.size));
  return {
    colour: firstInStock?.colour ?? null,
    // Only preselect size when there is a single choice: buyers should pick their size.
    size: sizes.size === 1 ? (firstInStock?.size ?? null) : null,
  };
}

export function ProductActions({
  product,
  whatsappNumber,
  url,
  currency,
}: {
  product: PublicProduct;
  whatsappNumber: string;
  url: string;
  currency: string;
}) {
  const router = useRouter();
  const [selection, setSelection] = useState(() => initialSelection(product));
  const [quantity, setQuantity] = useState(product.moq);
  const variant = findVariant(product.variants, selection.colour, selection.size);
  const canAdd = Boolean(variant && variant.stock > 0);
  const label = variant ? variantLabel(variant.size, variant.colour) : "";

  const enquiry = whatsappLink(
    whatsappNumber,
    [
      `Hi! I'm interested in ${product.title}`,
      label && `(${label})`,
      product.price === null
        ? "– could you share the price?"
        : `– ${formatPaise(product.price, currency)}`,
      url,
    ]
      .filter(Boolean)
      .join(" "),
  );

  function addToBag() {
    if (!variant || product.price === null) return;
    try {
      cart.add({
        productId: product.id,
        variantId: variant.id,
        quantity: Math.min(quantity, variant.stock),
        title: product.title,
        slug: product.slug,
        imageKey: product.images[0]?.key ?? null,
        size: variant.size,
        colour: variant.colour,
        price: product.price,
      });
      track("add_to_cart", { productId: product.id });
      toast.success("Added to bag", {
        description: [product.title, label].filter(Boolean).join(" · "),
        action: { label: "View bag", onClick: () => router.push("/cart") },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add to bag");
    }
  }

  return (
    <div className="space-y-6">
      <VariantPicker
        variants={product.variants}
        colour={selection.colour}
        size={selection.size}
        onChange={(next) => {
          setSelection(next);
          setQuantity(product.moq);
        }}
      />

      <div aria-live="polite" className="min-h-5 text-sm">
        {!product.inStock ? (
          <p className="text-muted-foreground">Sold out</p>
        ) : variant && variant.stock > 0 && variant.stock <= LOW_STOCK ? (
          <p className="text-brand">Only {variant.stock} left</p>
        ) : null}
      </div>

      {(product.moq > 1 || product.packSize) && (
        <ul className="space-y-1 rounded-sm bg-muted px-4 py-3 text-sm">
          {product.packSize && <li>Price is per set of {product.packSize} pieces</li>}
          {product.moq > 1 && <li>Minimum order: {product.moq}</li>}
        </ul>
      )}

      {product.priceOnRequest && (
        <div className="space-y-3 rounded-sm border px-4 py-4 text-sm">
          <p>
            <strong className="font-medium">Price on request.</strong>{" "}
            {product.unlockVia
              ? `Enter the passcode for ${product.unlockVia.name} to see prices and order, or ask us on WhatsApp.`
              : "Ask us on WhatsApp for the price."}
          </p>
          {product.unlockVia && <UnlockForm slug={product.unlockVia.slug} cta="See price" />}
        </div>
      )}

      {product.inStock && !product.priceOnRequest && (
        <div className="flex gap-3">
          <QuantityStepper
            value={quantity}
            onChange={setQuantity}
            min={1}
            max={Math.max(1, variant?.stock ?? 1)}
            label={product.packSize ? "Number of sets" : "Quantity"}
          />
          <Button size="lg" className="h-11 flex-1 text-base" onClick={addToBag} disabled={!canAdd}>
            <ShoppingBag className="size-5" aria-hidden />
            {canAdd ? "Add to bag" : selection.size ? "Unavailable" : "Select a size"}
          </Button>
        </div>
      )}

      {enquiry && (
        <Button asChild size="lg" variant="outline" className="h-11 w-full">
          <a href={enquiry} target="_blank" rel="noreferrer">
            <MessageCircle className="size-5" aria-hidden />
            {product.priceOnRequest ? "Ask for price on WhatsApp" : "Ask on WhatsApp"}
          </a>
        </Button>
      )}
    </div>
  );
}

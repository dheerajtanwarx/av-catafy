"use client";

import { formatPaise, type PublicProduct } from "@catafy/types";
import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { whatsappLink } from "@/lib/whatsapp";
import { findVariant, VariantPicker } from "./variant-picker";

const LOW_STOCK = 3;

function initialSelection(product: PublicProduct) {
  const firstInStock = product.variants.find((v) => v.stock > 0) ?? product.variants[0] ?? null;
  const colours = new Set(product.variants.map((v) => v.colour));
  const sizes = new Set(product.variants.map((v) => v.size));
  return {
    colour: firstInStock?.colour ?? null,
    // Only preselect size when there is a single choice: buyers should pick their size.
    size:
      sizes.size === 1 || (colours.size === 1 && sizes.size === 1)
        ? (firstInStock?.size ?? null)
        : null,
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
  const [selection, setSelection] = useState(() => initialSelection(product));
  const variant = findVariant(product.variants, selection.colour, selection.size);

  const variantLabel = variant
    ? [variant.colour, variant.size].filter((x) => x && x !== "Default").join(" / ")
    : "";
  const enquiry = whatsappLink(
    whatsappNumber,
    [
      `Hi! I'm interested in ${product.title}`,
      variantLabel && `(${variantLabel})`,
      `– ${formatPaise(product.price, currency)}`,
      url,
    ]
      .filter(Boolean)
      .join(" "),
  );

  return (
    <div className="space-y-6">
      <VariantPicker
        variants={product.variants}
        colour={selection.colour}
        size={selection.size}
        onChange={setSelection}
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
          {product.packSize && <li>Sold as a set of {product.packSize} pieces</li>}
          {product.moq > 1 && <li>Minimum order: {product.moq}</li>}
        </ul>
      )}

      {/* The bag/checkout button joins this in Phase 4. */}
      {enquiry && (
        <Button asChild size="lg" variant="outline" className="h-12 w-full text-base">
          <a href={enquiry} target="_blank" rel="noreferrer">
            <MessageCircle className="size-5" aria-hidden />
            Ask on WhatsApp
          </a>
        </Button>
      )}
    </div>
  );
}

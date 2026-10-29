import { formatPaise } from "@catafy/types";
import { cn } from "@/lib/utils";

export function Price({
  price,
  mrp,
  discountPercent,
  currency = "INR",
  size = "sm",
}: {
  /** Null when the price is on request. */
  price: number | null;
  mrp: number | null;
  discountPercent: number | null;
  currency?: string;
  size?: "sm" | "lg";
}) {
  if (price === null) {
    return (
      <p className={cn("text-muted-foreground italic", size === "lg" ? "text-xl" : "text-sm")}>
        Price on request
      </p>
    );
  }
  return (
    <p
      className={cn(
        "flex flex-wrap items-baseline gap-x-2",
        size === "lg" ? "text-2xl" : "text-sm",
      )}
    >
      <span className="font-medium tabular-nums">{formatPaise(price, currency)}</span>
      {discountPercent && mrp && (
        <>
          <span
            className={cn(
              "text-muted-foreground line-through tabular-nums",
              size === "lg" ? "text-base" : "text-xs",
            )}
          >
            <span className="sr-only">MRP </span>
            {formatPaise(mrp, currency)}
          </span>
          <span className={cn("font-medium text-brand", size === "lg" ? "text-base" : "text-xs")}>
            {discountPercent}% off
          </span>
        </>
      )}
    </p>
  );
}

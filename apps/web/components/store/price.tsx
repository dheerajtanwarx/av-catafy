import { formatPaise } from "@catafy/types";
import { cn } from "@/lib/utils";

export function Price({
  price,
  mrp,
  discountPercent,
  currency = "INR",
  size = "sm",
}: {
  price: number;
  mrp: number | null;
  discountPercent: number | null;
  currency?: string;
  size?: "sm" | "lg";
}) {
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

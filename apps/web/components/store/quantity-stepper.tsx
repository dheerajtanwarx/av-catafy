"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  label = "Quantity",
  size = "md",
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max: number;
  label?: string;
  size?: "sm" | "md";
}) {
  const btn = cn(
    "flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground",
    size === "sm" ? "size-8" : "size-11",
  );
  return (
    <div
      className={cn("inline-flex items-center rounded-sm border", size === "sm" ? "h-8" : "h-11")}
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label="Decrease quantity"
      >
        <Minus className="size-4" />
      </button>
      <output
        className={cn("text-center text-sm tabular-nums", size === "sm" ? "w-8" : "w-10")}
        aria-live="polite"
      >
        {value}
      </output>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label="Increase quantity"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

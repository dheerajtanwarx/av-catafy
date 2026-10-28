"use client";

import { rupeesToPaise } from "@catafy/types";
import { useEffect, useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";

type Props = Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  /** Value in paise; the owner types rupees. */
  value: number | null | undefined;
  onChange: (paise: number | null) => void;
};

function toRupeeString(paise: number | null | undefined): string {
  return paise === null || paise === undefined ? "" : String(paise / 100);
}

export function MoneyInput({ value, onChange, ...props }: Props) {
  const [text, setText] = useState(toRupeeString(value));

  // Sync when the form resets or loads a product, without fighting the user's typing.
  useEffect(() => {
    setText((current) => {
      const currentPaise = current === "" ? null : rupeesToPaise(Number(current));
      return currentPaise === (value ?? null) ? current : toRupeeString(value);
    });
  }, [value]);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
        ₹
      </span>
      <Input
        {...props}
        inputMode="decimal"
        className="pl-7"
        value={text}
        onChange={(e) => {
          const next = e.target.value.replace(/[^\d.]/g, "");
          if (!/^\d*\.?\d{0,2}$/.test(next)) return;
          setText(next);
          onChange(next === "" || next === "." ? null : rupeesToPaise(Number(next)));
        }}
      />
    </div>
  );
}

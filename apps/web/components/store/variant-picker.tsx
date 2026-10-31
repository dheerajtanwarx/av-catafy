"use client";

import type { PublicVariant } from "@catafy/types";
import { cn } from "@/lib/utils";

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function findVariant(variants: PublicVariant[], colour: string | null, size: string | null) {
  return variants.find((v) => v.colour === colour && v.size === size) ?? null;
}

/** Colour then size, like most fashion stores; unavailable combinations are disabled. */
export function VariantPicker({
  variants,
  colour,
  size,
  onChange,
}: {
  variants: PublicVariant[];
  colour: string | null;
  size: string | null;
  onChange: (next: { colour: string | null; size: string | null }) => void;
}) {
  const colours = unique(variants.map((v) => v.colour));
  const sizes = unique(variants.map((v) => v.size));

  const option = (selected: boolean, disabled: boolean) =>
    cn(
      "min-w-12 rounded-sm border px-3 py-2 text-sm transition-colors",
      selected ? "border-foreground bg-foreground text-background" : "hover:border-foreground",
      disabled &&
        "cursor-not-allowed text-muted-foreground line-through opacity-50 hover:border-border",
    );

  return (
    <div className="space-y-5">
      {colours.length > 1 && (
        <fieldset>
          <legend className="mb-2 text-sm">
            Colour: <span className="text-muted-foreground">{colour ?? "Select"}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {colours.map((c) => {
              const available = variants.some((v) => v.colour === c && v.stock > 0);
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={c === colour}
                  disabled={!available}
                  onClick={() => {
                    // Keep the size if it exists in the new colour.
                    const keep = size && findVariant(variants, c, size)?.stock ? size : null;
                    onChange({ colour: c, size: keep });
                  }}
                  className={option(c === colour, !available)}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {sizes.length > 1 && (
        <fieldset>
          <legend className="mb-2 text-sm">
            Size: <span className="text-muted-foreground">{size ?? "Select"}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => {
              const v = findVariant(variants, colour, s);
              const available = Boolean(v && v.stock > 0);
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={s === size}
                  disabled={!available}
                  onClick={() => onChange({ colour, size: s })}
                  className={option(s === size, !available)}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
    </div>
  );
}

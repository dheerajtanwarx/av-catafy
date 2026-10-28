"use client";

import type { ProductInput, ProductInputParsed } from "@catafy/types";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { useState } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function splitList(s: string): string[] {
  return [
    ...new Set(
      s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  ];
}

export function VariantsEditor() {
  const form = useFormContext<ProductInput, unknown, ProductInputParsed>();
  // keyName must not be "id": our variants carry their database id in `id`.
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "variants",
    keyName: "fieldKey",
  });
  const [sizes, setSizes] = useState("");
  const [colours, setColours] = useState("");

  function generate() {
    const existing = new Set(
      form.getValues("variants").map((v) => `${v.size.toLowerCase()}|${v.colour.toLowerCase()}`),
    );
    const combos = splitList(sizes).flatMap((size) =>
      splitList(colours).map((colour) => ({ size, colour, sku: "", stock: 0 })),
    );
    const fresh = combos.filter(
      (c) => !existing.has(`${c.size.toLowerCase()}|${c.colour.toLowerCase()}`),
    );
    if (fresh.length) append(fresh);
    setSizes("");
    setColours("");
  }

  const rootError =
    form.formState.errors.variants?.root?.message ?? form.formState.errors.variants?.message;
  const totalStock = form.watch("variants").reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-md border border-dashed p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="gen-sizes">Sizes</Label>
          <Input
            id="gen-sizes"
            value={sizes}
            onChange={(e) => setSizes(e.target.value)}
            placeholder="S, M, L, XL"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gen-colours">Colours</Label>
          <Input
            id="gen-colours"
            value={colours}
            onChange={(e) => setColours(e.target.value)}
            placeholder="Red, Navy"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={generate}
          disabled={!splitList(sizes).length || !splitList(colours).length}
        >
          <Wand2 className="size-4" aria-hidden />
          Add combinations
        </Button>
      </div>

      {fields.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Size</th>
                <th className="pb-2 font-medium">Colour</th>
                <th className="pb-2 font-medium">SKU (optional)</th>
                <th className="w-24 pb-2 font-medium">Stock</th>
                <th className="w-10 pb-2">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, i) => (
                <tr key={field.fieldKey} className="align-top">
                  {(["size", "colour", "sku"] as const).map((name) => (
                    <td key={name} className="pr-2 pb-2">
                      <FormField
                        control={form.control}
                        name={`variants.${i}.${name}`}
                        render={({ field: f }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                {...f}
                                value={f.value ?? ""}
                                aria-label={`Variant ${i + 1} ${name}`}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </td>
                  ))}
                  <td className="pr-2 pb-2">
                    <FormField
                      control={form.control}
                      name={`variants.${i}.stock`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              inputMode="numeric"
                              aria-label={`Variant ${i + 1} stock`}
                              {...f}
                              value={Number.isNaN(f.value) ? "" : f.value}
                              onChange={(e) =>
                                f.onChange(e.target.value === "" ? NaN : e.target.valueAsNumber)
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </td>
                  <td className="pb-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(i)}
                      aria-label={`Remove variant ${i + 1}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rootError && <p className="text-sm text-destructive">{rootError}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ size: "", colour: "", sku: "", stock: 0 })}
        >
          <Plus className="size-4" aria-hidden />
          Add variant
        </Button>
        <p className="text-sm text-muted-foreground">
          {fields.length} variant{fields.length === 1 ? "" : "s"} · {totalStock} in stock
        </p>
      </div>
    </div>
  );
}

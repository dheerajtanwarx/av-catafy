"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatPaise, type CatalogueProductSummary } from "@catafy/types";
import { Check, GripVertical, ImageOff, Plus, Search, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { imageUrl } from "@/lib/images";
import { useProducts } from "@/lib/queries";
import { cn } from "@/lib/utils";

export type ProductSummaries = Record<string, CatalogueProductSummary>;

function Thumb({ product }: { product?: CatalogueProductSummary }) {
  return (
    <div className="relative flex h-12 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
      {product?.image ? (
        <Image
          src={imageUrl(product.image.key)}
          alt=""
          fill
          sizes="36px"
          className="object-cover"
        />
      ) : (
        <ImageOff className="size-3.5 text-muted-foreground" aria-hidden />
      )}
    </div>
  );
}

function Row({
  id,
  index,
  product,
  onRemove,
}: {
  id: string;
  index: number;
  product?: CatalogueProductSummary;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-3 rounded-md border bg-card p-2",
        isDragging && "z-10 shadow-md",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab rounded p-1 text-muted-foreground hover:bg-accent active:cursor-grabbing"
        aria-label={`Reorder ${product?.title ?? "product"}, position ${index + 1}`}
      >
        <GripVertical className="size-4" />
      </button>
      <Thumb product={product} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{product?.title ?? "Unknown product"}</p>
        <p className="text-xs text-muted-foreground">{product ? formatPaise(product.price) : ""}</p>
      </div>
      {product && !product.isActive && (
        <Badge variant="outline" title="Inactive products are hidden in the store">
          Hidden
        </Badge>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        aria-label={`Remove ${product?.title ?? "product"}`}
      >
        <X className="size-4" />
      </Button>
    </li>
  );
}

function ProductPickerDialog({
  open,
  onOpenChange,
  selected,
  onToggle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: Set<string>;
  onToggle: (product: CatalogueProductSummary) => void;
}) {
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search.trim());
  const { data, isLoading } = useProducts({ q: q || undefined, limit: 50, sort: "newest" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add products</DialogTitle>
          <DialogDescription>
            Tap to add or remove. New products go to the end of the list.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products"
            className="pl-9"
            aria-label="Search products"
            autoFocus
          />
        </div>
        <ul className="-mx-2 flex-1 space-y-1 overflow-y-auto px-2">
          {isLoading &&
            Array.from({ length: 4 }, (_, i) => (
              <li key={i}>
                <Skeleton className="h-14 w-full" />
              </li>
            ))}
          {data?.items.length === 0 && (
            <li className="py-8 text-center text-sm text-muted-foreground">No products found</li>
          )}
          {data?.items.map((p) => {
            const summary: CatalogueProductSummary = {
              id: p.id,
              title: p.title,
              slug: p.slug,
              price: p.price,
              image: p.images[0] ?? null,
              isActive: p.isActive,
            };
            const isSelected = selected.has(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onToggle(summary)}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-accent",
                    isSelected && "bg-accent",
                  )}
                >
                  <Thumb product={summary} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatPaise(p.price)}
                      {!p.isActive && " · Inactive"}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full border",
                      isSelected && "border-foreground bg-foreground text-background",
                    )}
                    aria-hidden
                  >
                    {isSelected && <Check className="size-3.5" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done · {selected.size} selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Ordered product list for a catalogue: pick, drag to reorder, remove. */
export function CatalogueProducts({
  value,
  onChange,
  summaries,
  onSummaries,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  summaries: ProductSummaries;
  onSummaries: (s: ProductSummaries) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function toggle(product: CatalogueProductSummary) {
    if (value.includes(product.id)) {
      onChange(value.filter((id) => id !== product.id));
    } else {
      onSummaries({ ...summaries, [product.id]: product });
      onChange([...value, product.id]);
    }
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onChange(arrayMove(value, value.indexOf(String(active.id)), value.indexOf(String(over.id))));
  }

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No products yet. Add some to build this catalogue.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={value} strategy={verticalListSortingStrategy}>
            <ol className="space-y-2">
              {value.map((id, i) => (
                <Row
                  key={id}
                  id={id}
                  index={i}
                  product={summaries[id]}
                  onRemove={() => onChange(value.filter((x) => x !== id))}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Add products
        </Button>
        <span className="text-sm text-muted-foreground">
          {value.length} product{value.length === 1 ? "" : "s"} · drag to reorder
        </span>
      </div>
      <ProductPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selected={new Set(value)}
        onToggle={toggle}
      />
    </div>
  );
}

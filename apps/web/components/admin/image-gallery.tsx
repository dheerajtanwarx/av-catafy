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
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ImageValue, UploadFolder } from "@catafy/types";
import { GripVertical, ImagePlus, Loader2, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api";
import { imageUrl } from "@/lib/images";
import { ACCEPTED_IMAGE_TYPES, uploadImage } from "@/lib/upload";
import { cn } from "@/lib/utils";

interface Pending {
  id: string;
  preview: string;
  progress: number;
}

function SortableTile({
  image,
  index,
  onRemove,
  onAltChange,
}: {
  image: ImageValue;
  index: number;
  onRemove: () => void;
  onAltChange: (alt: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.key,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group space-y-1.5", isDragging && "z-10 opacity-80")}
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-md border bg-muted">
        <Image
          src={imageUrl(image.key)}
          alt={(image.alt ?? "") || `Product image ${index + 1}`}
          fill
          sizes="(min-width: 768px) 160px, 45vw"
          className="object-cover"
        />
        {index === 0 && (
          <Badge className="absolute top-2 left-2 bg-brand text-brand-foreground">Cover</Badge>
        )}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="absolute top-2 right-2 cursor-grab rounded bg-background/90 p-1 shadow-sm active:cursor-grabbing"
          aria-label={`Reorder image ${index + 1}. Use arrow keys after pressing space.`}
        >
          <GripVertical className="size-4" />
        </button>
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="absolute right-2 bottom-2 size-8 opacity-90 md:opacity-0 md:group-focus-within:opacity-90 md:group-hover:opacity-90"
          onClick={onRemove}
          aria-label={`Remove image ${index + 1}`}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      <Input
        value={image.alt ?? ""}
        onChange={(e) => onAltChange(e.target.value)}
        placeholder="Alt text (optional)"
        aria-label={`Alt text for image ${index + 1}`}
        className="h-8 text-xs"
      />
    </li>
  );
}

/** Uploads straight to R2, drag to reorder; the first image is the cover. */
export function ImageGallery({
  value,
  onChange,
  max,
  folder = "products",
}: {
  value: ImageValue[];
  onChange: (images: ImageValue[]) => void;
  max: number;
  folder?: UploadFolder;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragOver, setDragOver] = useState(false);
  // Uploads finish out of order; always append to the latest list.
  const latest = useRef(value);
  latest.current = value;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const slotsLeft = max - value.length - pending.length;

  async function addFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length > slotsLeft)
      toast.warning(`Only ${max} images per product; extra files skipped.`);
    await Promise.all(
      list.slice(0, Math.max(0, slotsLeft)).map(async (file) => {
        const id = crypto.randomUUID();
        const preview = URL.createObjectURL(file);
        setPending((p) => [...p, { id, preview, progress: 0 }]);
        try {
          const image = await uploadImage(file, folder, (progress) =>
            setPending((p) => p.map((x) => (x.id === id ? { ...x, progress } : x))),
          );
          onChange([...latest.current, image]);
        } catch (err) {
          toast.error(errorMessage(err));
        } finally {
          setPending((p) => p.filter((x) => x.id !== id));
          URL.revokeObjectURL(preview);
        }
      }),
    );
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = value.findIndex((i) => i.key === active.id);
    const to = value.findIndex((i) => i.key === over.id);
    onChange(arrayMove(value, from, to));
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
  }

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={value.map((i) => i.key)} strategy={rectSortingStrategy}>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {value.map((image, index) => (
              <SortableTile
                key={image.key}
                image={image}
                index={index}
                onRemove={() => onChange(value.filter((i) => i.key !== image.key))}
                onAltChange={(alt) =>
                  onChange(value.map((i) => (i.key === image.key ? { ...i, alt } : i)))
                }
              />
            ))}
            {pending.map((p) => (
              <li
                key={p.id}
                className="relative aspect-[3/4] overflow-hidden rounded-md border bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                <img src={p.preview} alt="" className="size-full object-cover opacity-50" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm">
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                  <span>{p.progress}%</span>
                </div>
              </li>
            ))}
            {slotsLeft > 0 && (
              <li>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  className={cn(
                    "flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground",
                    dragOver && "border-ring bg-accent text-foreground",
                  )}
                >
                  <ImagePlus className="size-6" aria-hidden />
                  <span>Add images</span>
                  <span className="text-xs">or drop here</span>
                </button>
              </li>
            )}
          </ul>
        </SortableContext>
      </DndContext>
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <p className="text-xs text-muted-foreground">
        JPEG, PNG, WebP or AVIF up to 10 MB · {value.length}/{max} · Drag to reorder; the first
        image is the cover.
      </p>
    </div>
  );
}

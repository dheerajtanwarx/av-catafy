"use client";

import type { ImageValue, UploadFolder } from "@catafy/types";
import { ImagePlus, Loader2, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api";
import { imageUrl } from "@/lib/images";
import { ACCEPTED_IMAGE_TYPES, uploadImage } from "@/lib/upload";

/** Single image picker (category/catalogue covers). */
export function ImageField({
  value,
  onChange,
  folder,
  label = "Upload image",
}: {
  value: ImageValue | null;
  onChange: (image: ImageValue | null) => void;
  folder: UploadFolder;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  async function onFile(file: File) {
    setProgress(0);
    try {
      onChange(await uploadImage(file, folder, setProgress));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-md border bg-muted">
        {value && (
          <Image
            src={imageUrl(value.key)}
            alt={value.alt ?? ""}
            fill
            sizes="80px"
            className="object-cover"
          />
        )}
        {progress !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-xs">
            <Loader2 className="mr-1 size-3 animate-spin" aria-hidden />
            {progress}%
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => input.current?.click()}
          disabled={progress !== null}
        >
          <ImagePlus className="size-4" aria-hidden />
          {value ? "Replace" : label}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <X className="size-4" aria-hidden />
            Remove
          </Button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

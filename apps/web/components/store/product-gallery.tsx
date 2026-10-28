"use client";

import type { ImageInput } from "@catafy/types";
import { X } from "lucide-react";
import Image from "next/image";
import { useRef, useState, type MouseEvent } from "react";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { imageUrl } from "@/lib/images";
import { cn } from "@/lib/utils";

/**
 * Mobile: swipeable (scroll-snap) with dots. Desktop: thumbnails + hover zoom.
 * Tapping/clicking opens a full-screen view where pinch-zoom works natively.
 */
export function ProductGallery({ images, title }: { images: ImageInput[]; title: string }) {
  const [active, setActive] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [origin, setOrigin] = useState<string | null>(null);
  const track = useRef<HTMLDivElement>(null);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[3/4] items-center justify-center rounded-sm bg-muted font-display text-2xl">
        {title}
      </div>
    );
  }

  function goTo(i: number) {
    setActive(i);
    track.current?.children[i]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "start",
    });
  }

  function onScroll() {
    const el = track.current;
    if (el) setActive(Math.round(el.scrollLeft / el.clientWidth));
  }

  function onMove(e: MouseEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setOrigin(
      `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`,
    );
  }

  const alt = (i: number) => images[i]?.alt || `${title}, image ${i + 1} of ${images.length}`;

  return (
    <div className="md:grid md:grid-cols-[72px_1fr] md:gap-4">
      {images.length > 1 && (
        <ul className="hidden flex-col gap-3 md:flex" aria-label="Product images">
          {images.map((img, i) => (
            <li key={img.key}>
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Show image ${i + 1}`}
                aria-current={i === active}
                className={cn(
                  "relative block aspect-[3/4] w-full overflow-hidden rounded-sm border-2 transition-colors",
                  i === active ? "border-foreground" : "border-transparent hover:border-border",
                )}
              >
                <Image src={imageUrl(img.key)} alt="" fill sizes="72px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative -mx-4 md:mx-0">
        <div
          ref={track}
          onScroll={onScroll}
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] md:overflow-hidden"
        >
          {images.map((img, i) => (
            <button
              key={img.key}
              type="button"
              onClick={() => {
                setActive(i);
                setZoomOpen(true);
              }}
              onMouseMove={onMove}
              onMouseLeave={() => setOrigin(null)}
              className="relative aspect-[3/4] w-full shrink-0 snap-start overflow-hidden bg-muted md:cursor-zoom-in md:rounded-sm"
              aria-label={`Enlarge image ${i + 1}`}
            >
              <Image
                src={imageUrl(img.key)}
                alt={alt(i)}
                fill
                priority={i === 0}
                sizes="(min-width: 768px) 50vw, 100vw"
                className={cn(
                  "object-cover transition-transform duration-200",
                  origin && i === active && "md:scale-[2]",
                )}
                style={origin && i === active ? { transformOrigin: origin } : undefined}
              />
            </button>
          ))}
        </div>
        {images.length > 1 && (
          <div
            className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5 md:hidden"
            aria-hidden
          >
            {images.map((img, i) => (
              <span
                key={img.key}
                className={cn(
                  "size-1.5 rounded-full transition-colors",
                  i === active ? "bg-foreground" : "bg-foreground/30",
                )}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent
          showCloseButton={false}
          className="h-dvh max-w-none overflow-auto rounded-none border-0 bg-background p-0 sm:max-w-none"
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <DialogClose
            className="fixed top-4 right-4 z-10 rounded-full bg-background/90 p-2 shadow"
            aria-label="Close"
          >
            <X className="size-5" />
          </DialogClose>
          <div className="flex min-h-full flex-col items-center gap-2 py-2 [touch-action:pinch-zoom_pan-x_pan-y]">
            {/* Natural-size images so pinch/scroll zoom shows full detail. */}
            {images.map((img, i) => (
              <Image
                key={img.key}
                src={imageUrl(img.key)}
                alt={alt(i)}
                width={img.width}
                height={img.height}
                sizes="100vw"
                quality={90}
                className="h-auto w-full max-w-3xl"
                ref={(el) => {
                  if (el && i === active && zoomOpen) el.scrollIntoView({ block: "start" });
                }}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

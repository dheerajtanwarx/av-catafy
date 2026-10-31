import { imageUrl } from "./images";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
  /\/+$/,
  "",
);

/**
 * Open Graph image served through the Next.js image optimizer: resized and re-encoded so
 * WhatsApp/Instagram previews load fast instead of fetching the full-size original from R2.
 */
export function ogImageUrl(key: string): string {
  return `${SITE_URL}/_next/image?url=${encodeURIComponent(imageUrl(key))}&w=1200&q=75`;
}

export function truncate(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

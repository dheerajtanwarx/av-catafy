import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { getSitemap } from "@/lib/storefront";

// Generated on request (from cached API data) so builds don't need the API running.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await getSitemap();
  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/products`, changeFrequency: "daily", priority: 0.8 },
    ...entries.map((e) => ({ url: `${SITE_URL}${e.path}`, lastModified: e.updatedAt })),
  ];
}

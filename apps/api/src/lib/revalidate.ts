import { CATALOG_CACHE_TAG } from "@catafy/types";
import type { Logger } from "pino";

export type Revalidate = () => void;

/**
 * Tells Next.js to drop its cached storefront data. Fire-and-forget: a failed call only means
 * the storefront catches up when the hourly revalidation kicks in.
 */
export function createRevalidator(
  webUrl: string | undefined,
  secret: string,
  logger: Logger,
): Revalidate {
  if (!webUrl) {
    logger.warn("WEB_INTERNAL_URL not set: storefront updates wait for hourly revalidation");
    return () => undefined;
  }
  const endpoint = `${webUrl.replace(/\/+$/, "")}/api/revalidate`;
  return () => {
    fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "x-revalidate-secret": secret },
      body: JSON.stringify({ tags: [CATALOG_CACHE_TAG] }),
      signal: AbortSignal.timeout(5000),
    })
      .then((res) => {
        if (!res.ok) logger.warn({ status: res.status }, "Storefront revalidation rejected");
      })
      .catch((err: unknown) => logger.warn({ err }, "Storefront revalidation failed"));
  };
}

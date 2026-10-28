import { timingSafeEqual } from "node:crypto";
import { CATALOG_CACHE_TAG } from "@catafy/types";
import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

const bodySchema = z.object({ tags: z.array(z.enum([CATALOG_CACHE_TAG])).min(1) });

function secretMatches(provided: string | null): boolean {
  const expected = process.env.REVALIDATE_SECRET ?? "";
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Called by the API after admin writes so the storefront shows changes immediately. */
export async function POST(req: NextRequest) {
  if (!secretMatches(req.headers.get("x-revalidate-secret"))) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Bad secret" } },
      { status: 401 },
    );
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Invalid tags" } },
      { status: 400 },
    );
  }
  for (const tag of parsed.data.tags) revalidateTag(tag);
  return NextResponse.json({ revalidated: parsed.data.tags });
}

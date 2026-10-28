import { toSlug } from "@catafy/types";
import type { Model, Types } from "mongoose";

/**
 * Returns `base` (or base-2, base-3, ...) that no other document in the collection uses.
 * The unique index remains the final guard against races.
 */
export async function uniqueSlug<T>(
  model: Model<T>,
  source: string,
  excludeId?: Types.ObjectId | string,
): Promise<string> {
  const base = toSlug(source) || "item";
  const taken = await model
    .find({
      slug: { $regex: `^${base}(-\\d+)?$` },
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })
    .select("slug")
    .lean<{ slug: string }[]>();
  const used = new Set(taken.map((d) => d.slug));
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
}

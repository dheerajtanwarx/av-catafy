const base = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ?? "";

/** Public URL for an R2 object key stored in the database. */
export function imageUrl(key: string): string {
  return `${base}/${key}`;
}

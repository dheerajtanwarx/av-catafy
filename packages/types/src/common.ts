import { z } from "zod";

/** Money is always stored and transferred as integer paise (1 INR = 100 paise). */
export const paiseSchema = z.number().int().nonnegative();

export const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens");

export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");

/** Indian mobile number, normalised to 10 digits (strips spaces, dashes, +91 / leading 0). */
export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, ""))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"));

export const pincodeSchema = z.string().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit pincode");

export function toSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

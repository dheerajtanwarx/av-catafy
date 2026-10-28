import { z } from "zod";

export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

export const UPLOAD_CONTENT_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
} as const;
export type UploadContentType = keyof typeof UPLOAD_CONTENT_TYPES;

export const UPLOAD_FOLDERS = ["products", "categories", "catalogues", "store"] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

export const presignUploadInputSchema = z.object({
  folder: z.enum(UPLOAD_FOLDERS),
  contentType: z.enum(
    Object.keys(UPLOAD_CONTENT_TYPES) as [UploadContentType, ...UploadContentType[]],
    { errorMap: () => ({ message: "Only JPEG, PNG, WebP or AVIF images are allowed" }) },
  ),
  size: z
    .number()
    .int()
    .positive()
    .max(UPLOAD_MAX_BYTES, `Images must be ${UPLOAD_MAX_BYTES / 1024 / 1024} MB or smaller`),
});
export type PresignUploadInput = z.infer<typeof presignUploadInputSchema>;

export interface PresignUploadResult {
  key: string;
  uploadUrl: string;
  publicUrl: string;
  /** Headers the browser must send with the PUT, exactly as signed. */
  headers: Record<string, string>;
}

/** Keys the API itself generated: `<folder>/<uuid>.<ext>`. Anything else is rejected on save. */
export const imageKeySchema = z
  .string()
  .regex(
    /^(products|categories|catalogues|store)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|avif)$/,
    "Invalid image key",
  );

export const imageInputSchema = z.object({
  key: imageKeySchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string().trim().max(200).default(""),
});
export type ImageInput = z.output<typeof imageInputSchema>;
/** Form-side shape (alt may be omitted). */
export type ImageValue = z.input<typeof imageInputSchema>;

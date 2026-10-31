import { z } from "zod";
import { imageInputSchema, type ImageInput } from "./uploads.js";

const url = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Use a full link starting with https://");

export const storeSettingsInputSchema = z.object({
  storeName: z.string().trim().min(1, "Store name is required").max(80),
  description: z.string().trim().max(500).default(""),
  logo: imageInputSchema.nullable().default(null),
  banner: imageInputSchema.nullable().default(null),
  whatsappNumber: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || /^\+?[\d\s-]{10,16}$/.test(v),
      "Enter a mobile number, e.g. 98765 43210 or +91 98765 43210",
    )
    .default(""),
  address: z.string().trim().max(500).default(""),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Use a 3-letter code such as INR")
    .default("INR"),
  accentColor: z.string().regex(/^#[0-9a-f]{6}$/i, "Use a colour like #9f4a54"),
  socialLinks: z
    .object({ instagram: url, facebook: url, youtube: url, website: url })
    .default({ instagram: "", facebook: "", youtube: "", website: "" }),
  orderConfirmationTemplate: z.string().trim().max(1000).default(""),
  lowStockThreshold: z.number().int().min(0).max(1000).default(5),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || /^[0-9A-Z]{15}$/.test(v), "A GSTIN has 15 letters and digits")
    .default(""),
  showTaxInclusive: z.boolean().default(false),
});
export type StoreSettingsInput = z.input<typeof storeSettingsInputSchema>;
export type StoreSettingsInputParsed = z.output<typeof storeSettingsInputSchema>;

export interface StoreSettingsDto extends Omit<StoreSettingsInputParsed, "logo" | "banner"> {
  logo: ImageInput | null;
  banner: ImageInput | null;
  updatedAt: string;
}

/** Placeholders the owner can use in the order confirmation message. */
export const ORDER_MESSAGE_PLACEHOLDERS = [
  "name",
  "orderNumber",
  "total",
  "items",
  "storeName",
  "amountDue",
] as const;
export type OrderMessageVars = Record<(typeof ORDER_MESSAGE_PLACEHOLDERS)[number], string>;

export const DEFAULT_ORDER_CONFIRMATION_TEMPLATE =
  "Hi {{name}}, thank you for your order {{orderNumber}} of {{total}}. We will confirm it shortly.";

/** Fills {{placeholders}}; unknown ones are left as typed so the owner notices them. */
export function renderOrderMessage(template: string, vars: OrderMessageVars): string {
  const source = template.trim() || DEFAULT_ORDER_CONFIRMATION_TEMPLATE;
  return source.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    key in vars ? vars[key as keyof OrderMessageVars] : match,
  );
}

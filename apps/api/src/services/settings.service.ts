import type {
  ImageInput,
  InvoiceStoreInfo,
  StoreSettingsDto,
  StoreSettingsInputParsed,
} from "@catafy/types";
import { STORE_SETTINGS_KEY, StoreSettings, type StoreSettingsDoc } from "../models/index.js";

/** What invoices and packing slips print in their header. */
export async function getInvoiceStoreInfo(): Promise<InvoiceStoreInfo> {
  const s = await StoreSettings.findOne({ key: STORE_SETTINGS_KEY }).lean();
  if (!s) throw new Error("Store settings missing: run `pnpm seed`");
  return {
    storeName: s.storeName,
    address: s.address,
    whatsappNumber: s.whatsappNumber,
    currency: s.currency,
    gstin: s.gstin,
    showTaxInclusive: s.showTaxInclusive,
    logoKey: s.logo?.key ?? null,
  };
}

type SettingsLean = NonNullable<Awaited<ReturnType<typeof loadSettings>>>;

function loadSettings() {
  return StoreSettings.findOne({ key: STORE_SETTINGS_KEY }).lean<
    StoreSettingsDoc & { updatedAt: Date }
  >();
}

function image(i: SettingsLean["logo"]): ImageInput | null {
  return i ? { key: i.key, width: i.width, height: i.height, alt: i.alt } : null;
}

function toDto(s: SettingsLean): StoreSettingsDto {
  return {
    storeName: s.storeName,
    description: s.description,
    logo: image(s.logo),
    banner: image(s.banner),
    whatsappNumber: s.whatsappNumber,
    address: s.address,
    currency: s.currency,
    accentColor: s.accentColor,
    socialLinks: {
      instagram: s.socialLinks?.instagram ?? "",
      facebook: s.socialLinks?.facebook ?? "",
      youtube: s.socialLinks?.youtube ?? "",
      website: s.socialLinks?.website ?? "",
    },
    orderConfirmationTemplate: s.orderConfirmationTemplate,
    lowStockThreshold: s.lowStockThreshold,
    gstin: s.gstin,
    showTaxInclusive: s.showTaxInclusive,
    updatedAt: s.updatedAt.toISOString(),
  };
}

export async function getSettings(): Promise<StoreSettingsDto> {
  const s = await loadSettings();
  if (!s) throw new Error("Store settings missing: run `pnpm seed`");
  return toDto(s);
}

export async function updateSettings(input: StoreSettingsInputParsed): Promise<StoreSettingsDto> {
  const { matchedCount } = await StoreSettings.updateOne(
    { key: STORE_SETTINGS_KEY },
    { $set: input },
    { runValidators: true },
  );
  if (!matchedCount) throw new Error("Store settings missing: run `pnpm seed`");
  return getSettings();
}

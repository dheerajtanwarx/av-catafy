import type { InvoiceStoreInfo } from "@catafy/types";
import { STORE_SETTINGS_KEY, StoreSettings } from "../models/index.js";

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

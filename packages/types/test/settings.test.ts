import { describe, expect, it } from "vitest";
import { renderOrderMessage, storeSettingsInputSchema } from "../src/settings.js";

const vars = {
  name: "Priya",
  orderNumber: "ORD-2026-00042",
  total: "₹2,598",
  items: "1. Kurti × 2",
  storeName: "My Boutique",
  amountDue: "₹2,598",
};

describe("order confirmation message", () => {
  it("fills placeholders, tolerating spaces", () => {
    expect(renderOrderMessage("Hi {{ name }}, {{orderNumber}} = {{total}}", vars)).toBe(
      "Hi Priya, ORD-2026-00042 = ₹2,598",
    );
  });

  it("leaves unknown placeholders visible and falls back to the default when blank", () => {
    expect(renderOrderMessage("{{nickname}}", vars)).toBe("{{nickname}}");
    expect(renderOrderMessage("  ", vars)).toContain("thank you for your order ORD-2026-00042");
  });
});

describe("store settings input", () => {
  const base = { storeName: "Boutique", accentColor: "#9f4a54" };

  it("normalises currency and GSTIN", () => {
    expect(
      storeSettingsInputSchema.parse({ ...base, currency: "inr", gstin: "09abcde1234f1z5" }),
    ).toMatchObject({ currency: "INR", gstin: "09ABCDE1234F1Z5", lowStockThreshold: 5 });
  });

  it.each([
    { accentColor: "red" },
    { whatsappNumber: "12345" },
    { gstin: "SHORT" },
    { socialLinks: { instagram: "instagram.com/x", facebook: "", youtube: "", website: "" } },
  ])("rejects %o", (bad) => {
    expect(storeSettingsInputSchema.safeParse({ ...base, ...bad }).success).toBe(false);
  });
});

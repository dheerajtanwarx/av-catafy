import { describe, expect, it } from "vitest";
import { phoneSchema, slugSchema, toSlug } from "../src/common.js";
import { discountPercent } from "../src/storefront.js";

describe("phoneSchema", () => {
  it.each(["9876543210", "+91 98765 43210", "09876543210", "91-9876543210"])(
    "normalises %s",
    (input) => {
      expect(phoneSchema.parse(input)).toBe("9876543210");
    },
  );

  it("rejects non-mobile numbers", () => {
    expect(phoneSchema.safeParse("1234567890").success).toBe(false);
    expect(phoneSchema.safeParse("98765").success).toBe(false);
  });
});

describe("toSlug", () => {
  it("produces a valid slug", () => {
    const slug = toSlug("  Diwali Collection — 2026! ");
    expect(slug).toBe("diwali-collection-2026");
    expect(slugSchema.safeParse(slug).success).toBe(true);
  });
});

describe("discountPercent", () => {
  it("rounds to whole percent", () => {
    expect(discountPercent(129900, 159900)).toBe(19);
  });

  it("returns null without a real discount", () => {
    expect(discountPercent(1000, null)).toBeNull();
    expect(discountPercent(1000, 1000)).toBeNull();
    expect(discountPercent(1000, 900)).toBeNull();
  });
});

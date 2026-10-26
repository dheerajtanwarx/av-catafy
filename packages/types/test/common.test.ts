import { describe, expect, it } from "vitest";
import { phoneSchema, slugSchema, toSlug } from "../src/common.js";

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

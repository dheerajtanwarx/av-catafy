import { describe, expect, it } from "vitest";
import { formatOrderNumber } from "../src/lib/counters.js";

describe("formatOrderNumber", () => {
  it("pads the sequence to five digits", () => {
    expect(formatOrderNumber(2026, 42)).toBe("ORD-2026-00042");
  });

  it("does not truncate sequences beyond five digits", () => {
    expect(formatOrderNumber(2026, 123456)).toBe("ORD-2026-123456");
  });
});

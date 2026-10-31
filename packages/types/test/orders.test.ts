import { describe, expect, it } from "vitest";
import { checkoutInputSchema, lineTotal, mergeCartItems, orderTotals } from "../src/orders.js";

const P = "64b7f0c2a1b2c3d4e5f60718";
const V1 = "64b7f0c2a1b2c3d4e5f60719";
const V2 = "64b7f0c2a1b2c3d4e5f6071a";

describe("pricing", () => {
  it("multiplies integer paise exactly", () => {
    expect(lineTotal({ unitPrice: 129900, quantity: 3 })).toBe(389700);
  });

  it("sums lines without floating point drift", () => {
    // 0.1 + 0.2 style values in rupees would drift as floats; paise never do.
    const lines = Array.from({ length: 10 }, () => ({ unitPrice: 10, quantity: 1 }));
    expect(orderTotals([...lines, { unitPrice: 20, quantity: 1 }])).toEqual({
      subtotal: 120,
      total: 120,
    });
  });

  it.each([
    { unitPrice: 99.5, quantity: 1 },
    { unitPrice: 100, quantity: 0 },
    { unitPrice: -1, quantity: 1 },
    { unitPrice: 100, quantity: 1.5 },
  ])("rejects invalid input %o", (line) => {
    expect(() => lineTotal(line)).toThrow(RangeError);
  });
});

describe("mergeCartItems", () => {
  it("combines repeated variants and caps the quantity", () => {
    const merged = mergeCartItems([
      { productId: P, variantId: V1, quantity: 2 },
      { productId: P, variantId: V2, quantity: 1 },
      { productId: P, variantId: V1, quantity: 998 },
    ]);
    expect(merged).toEqual([
      { productId: P, variantId: V1, quantity: 999 },
      { productId: P, variantId: V2, quantity: 1 },
    ]);
  });
});

describe("checkoutInputSchema", () => {
  const valid = {
    customer: {
      name: "Priya",
      phone: "+91 98765 43210",
      line1: "12 MG Road, Flat 4",
      city: "Lucknow",
      pincode: "226001",
    },
    items: [{ productId: P, variantId: V1, quantity: 1 }],
  };

  it("normalises the phone number", () => {
    expect(checkoutInputSchema.parse(valid).customer.phone).toBe("9876543210");
  });

  it("rejects an empty bag, a bad pincode and client-sent prices are ignored", () => {
    expect(checkoutInputSchema.safeParse({ ...valid, items: [] }).success).toBe(false);
    expect(
      checkoutInputSchema.safeParse({ ...valid, customer: { ...valid.customer, pincode: "12345" } })
        .success,
    ).toBe(false);
    const withPrice = checkoutInputSchema.parse({
      ...valid,
      items: [{ ...valid.items[0], unitPrice: 1 }],
    });
    expect(withPrice.items[0]).not.toHaveProperty("unitPrice");
  });
});

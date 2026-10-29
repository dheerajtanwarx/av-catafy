import { describe, expect, it } from "vitest";
import {
  canTransition,
  nextOrderStatuses,
  orderUpdateInputSchema,
  paymentStatusFor,
} from "../src/admin-orders.js";

describe("order status workflow", () => {
  it("moves forward, may skip steps, and can cancel until delivered", () => {
    expect(nextOrderStatuses("PENDING")).toEqual([
      "CONFIRMED",
      "PACKED",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
    ]);
    expect(nextOrderStatuses("SHIPPED")).toEqual(["DELIVERED", "CANCELLED"]);
    expect(canTransition("PENDING", "SHIPPED")).toBe(true);
  });

  it("never moves backwards", () => {
    expect(canTransition("PACKED", "CONFIRMED")).toBe(false);
    expect(canTransition("CONFIRMED", "CONFIRMED")).toBe(false);
  });

  it("treats delivered and cancelled as final", () => {
    expect(nextOrderStatuses("DELIVERED")).toEqual([]);
    expect(nextOrderStatuses("CANCELLED")).toEqual([]);
    expect(canTransition("CANCELLED", "PENDING")).toBe(false);
  });
});

describe("payment status", () => {
  it.each([
    [0, 100000, "UNPAID"],
    [1, 100000, "PARTIAL"],
    [99999, 100000, "PARTIAL"],
    [100000, 100000, "PAID"],
    [120000, 100000, "PAID"],
  ] as const)("%i received of %i is %s", (received, total, expected) => {
    expect(paymentStatusFor(received, total)).toBe(expected);
  });
});

describe("order update input", () => {
  it("accepts a partial update", () => {
    expect(orderUpdateInputSchema.parse({ amountReceived: 5000 })).toEqual({
      amountReceived: 5000,
    });
  });

  it("rejects an empty update and fractional paise", () => {
    expect(orderUpdateInputSchema.safeParse({}).success).toBe(false);
    expect(orderUpdateInputSchema.safeParse({ amountReceived: 10.5 }).success).toBe(false);
  });
});

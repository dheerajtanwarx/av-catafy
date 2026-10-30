import type { OrderConfirmation } from "@catafy/types";
import { describe, expect, it } from "vitest";
import { orderWhatsappMessage, variantLabel } from "../lib/order-message";

const order: OrderConfirmation = {
  orderNumber: "ORD-2026-00042",
  token: "t".repeat(24),
  createdAt: "2026-10-29T06:30:00.000Z",
  status: "PENDING",
  paymentStatus: "UNPAID",
  customer: {
    name: "Priya Sharma",
    phone: "9876543210",
    line1: "12 MG Road",
    city: "Lucknow",
    state: "",
    pincode: "226001",
  },
  note: "",
  items: [
    {
      title: "Kurti",
      slug: "kurti",
      imageKey: null,
      size: "M",
      colour: "White",
      unitPrice: 129900,
      quantity: 2,
      lineTotal: 259800,
    },
    {
      title: "Dupatta",
      slug: "dupatta",
      imageKey: null,
      size: "Free size",
      colour: "Default",
      unitPrice: 89900,
      quantity: 1,
      lineTotal: 89900,
    },
  ],
  subtotal: 349700,
  total: 349700,
};

describe("buyer's WhatsApp order message", () => {
  it("lists every line with its total and the order total", () => {
    const msg = orderWhatsappMessage(order, "My Boutique", "INR");
    expect(msg).toContain("*Order ORD-2026-00042*");
    expect(msg).toContain("1. Kurti (M / White) × 2 – ₹2,598");
    expect(msg).toContain("*Total: ₹3,497*");
    expect(msg).toContain("Address: 12 MG Road, Lucknow - 226001");
    expect(msg).not.toContain("Note:");
  });

  it("hides placeholder variant names", () => {
    expect(variantLabel("Free size", "Default")).toBe("Free size");
    expect(variantLabel("M", "Default")).toBe("M");
  });
});

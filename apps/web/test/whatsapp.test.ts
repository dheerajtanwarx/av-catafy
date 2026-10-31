import { describe, expect, it } from "vitest";
import { whatsappLink, whatsappNumber } from "../lib/whatsapp";

describe("whatsapp numbers", () => {
  it.each([
    ["98765 43210", "919876543210"],
    ["+91 98765-43210", "919876543210"],
    ["919876543210", "919876543210"],
    ["+44 7700 900123", "447700900123"],
    ["12345", null],
    ["", null],
  ])("%s → %s", (raw, expected) => expect(whatsappNumber(raw)).toBe(expected));

  it("encodes the prefilled message", () => {
    expect(whatsappLink("9876543210", "Hi & bye\nOrder #1")).toBe(
      "https://wa.me/919876543210?text=Hi%20%26%20bye%0AOrder%20%231",
    );
    expect(whatsappLink("nope", "x")).toBeNull();
  });
});

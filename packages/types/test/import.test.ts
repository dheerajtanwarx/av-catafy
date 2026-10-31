import { describe, expect, it } from "vitest";
import { importRowSchema, normaliseHeader } from "../src/import.js";

describe("import headers", () => {
  it.each([
    ["Pack Size", "pack_size"],
    ["pack-size", "pack_size"],
    [" Title* ", "title"],
    ["Color", "colour"],
  ])("%s → %s", (raw, expected) => expect(normaliseHeader(raw)).toBe(expected));
});

describe("import rows", () => {
  it("coerces spreadsheet cells", () => {
    const row = importRowSchema.parse({
      title: "  Kurti ",
      price: "₹1,299.50",
      mrp: 1799,
      stock: "10",
      featured: "Yes",
      active: false,
      moq: null,
    });
    expect(row).toMatchObject({
      title: "Kurti",
      price: 129950,
      mrp: 179900,
      stock: 10,
      featured: true,
      active: false,
      moq: undefined,
      slug: "",
      size: "",
    });
  });

  it("rejects bad numbers, fractions of paise, bad yes/no and bad slugs", () => {
    const issues = (cells: object) =>
      importRowSchema.safeParse({ title: "A", ...cells }).error?.issues.map((i) => i.path[0]);
    expect(issues({ price: "abc" })).toEqual(["price"]);
    expect(issues({ price: 10.555 })).toEqual(["price"]);
    expect(issues({ stock: 2.5 })).toEqual(["stock"]);
    expect(issues({ stock: -1 })).toEqual(["stock"]);
    expect(issues({ featured: "maybe" })).toEqual(["featured"]);
    expect(issues({ slug: "Not A Slug" })).toEqual(["slug"]);
  });
});

import { describe, expect, it } from "vitest";
import { parseImportFile } from "../lib/import-file";

const csv = (text: string) => new File([text], "products.csv", { type: "text/csv" });

describe("spreadsheet parsing for bulk import", () => {
  it("normalises headers, keeps spreadsheet row numbers and skips blank rows", async () => {
    const parsed = await parseImportFile(
      csv(
        [
          "Title*,Price*,Stock*,Color,Pack Size,Notes",
          "Kurti,1299,5,White,,ignore me",
          ",,,,,",
          "Saree,2499,2,Red,3,",
        ].join("\n"),
      ),
    );
    expect(parsed.missing).toEqual([]);
    expect(parsed.ignored).toEqual(["Notes"]);
    expect(parsed.rows).toEqual([
      {
        row: 2,
        cells: { title: "Kurti", price: "1299", stock: "5", colour: "White", pack_size: "" },
      },
      {
        row: 4,
        cells: { title: "Saree", price: "2499", stock: "2", colour: "Red", pack_size: "3" },
      },
    ]);
  });

  it("reports missing required columns", async () => {
    const parsed = await parseImportFile(csv("title,colour\nKurti,Red"));
    expect(parsed.missing).toEqual(["price", "stock"]);
  });
});

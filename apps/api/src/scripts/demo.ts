import type mongoose from "mongoose";
import { connectDb, disconnectDb } from "../db.js";
import { env } from "../env.js";
import { createLogger } from "../lib/logger.js";
import { createRevalidator } from "../lib/revalidate.js";
import { Catalogue, Category, Product } from "../models/index.js";

/**
 * Demo catalogue for trying the storefront before real products exist.
 *   pnpm demo          add (skips anything already there)
 *   pnpm demo:remove   delete everything this script created
 * Demo records are marked with the "demo" tag (products) or the DEMO_MARK description prefix.
 */
const DEMO_TAG = "demo";
const DEMO_MARK = "[demo]";

const logger = createLogger(env.LOG_LEVEL, env.NODE_ENV === "development");

const categories = [
  { name: "Kurtis", slug: "kurtis", sortOrder: 1 },
  { name: "Sarees", slug: "sarees", sortOrder: 2 },
  { name: "Co-ord Sets", slug: "co-ord-sets", sortOrder: 3 },
];

const sizes = (colour: string, stock: number[]) =>
  ["S", "M", "L", "XL"].map((size, i) => ({ size, colour, stock: stock[i] ?? 0 }));

const products = [
  {
    title: "Chikankari Cotton Kurti",
    category: "kurtis",
    price: 129900,
    mrp: 159900,
    fabric: "Pure cotton",
    care: "Gentle hand wash in cold water. Dry in shade.",
    description:
      "Hand-embroidered Lucknowi chikankari on breathable cotton. Straight fit, calf length.",
    tags: ["cotton", "chikankari", "white"],
    isFeatured: true,
    variants: [...sizes("White", [2, 5, 4, 1]), ...sizes("Powder Pink", [0, 3, 2, 0])],
  },
  {
    title: "Block Print Anarkali Kurta",
    category: "kurtis",
    price: 189900,
    mrp: 229900,
    fabric: "Cotton mul",
    care: "Hand wash separately.",
    description: "Jaipuri hand block print with a flared anarkali silhouette and tassel tie-ups.",
    tags: ["cotton", "block print", "indigo"],
    isFeatured: true,
    variants: sizes("Indigo", [3, 6, 4, 2]),
  },
  {
    title: "Mirror Work Rayon Kurti",
    category: "kurtis",
    price: 99900,
    mrp: null,
    fabric: "Rayon",
    care: "Dry clean recommended.",
    description: "Everyday kurti with mirror-work yoke. Pairs with jeans or palazzos.",
    tags: ["rayon", "mirror work", "mustard"],
    isFeatured: false,
    variants: sizes("Mustard", [4, 8, 6, 3]),
  },
  {
    title: "Banarasi Silk Saree",
    category: "sarees",
    price: 549900,
    mrp: 649900,
    fabric: "Banarasi silk with zari",
    care: "Dry clean only.",
    description:
      "Handwoven Banarasi with gold zari buttis and a rich pallu. Comes with unstitched blouse piece.",
    tags: ["silk", "banarasi", "festive", "wedding"],
    isFeatured: true,
    variants: [
      { size: "Free size", colour: "Maroon", stock: 3 },
      { size: "Free size", colour: "Emerald", stock: 2 },
    ],
  },
  {
    title: "Kota Doria Saree",
    category: "sarees",
    price: 249900,
    mrp: null,
    fabric: "Kota doria cotton-silk",
    care: "Hand wash or dry clean.",
    description: "Featherlight Kota doria with a woven border. Perfect for summer.",
    tags: ["kota", "summer", "lightweight"],
    isFeatured: false,
    variants: [{ size: "Free size", colour: "Peach", stock: 0 }],
  },
  {
    title: "Linen Co-ord Set",
    category: "co-ord-sets",
    price: 279900,
    mrp: 329900,
    fabric: "Linen blend",
    care: "Machine wash gentle.",
    description: "Relaxed shirt and straight pants in breathable linen. Two-piece set.",
    tags: ["linen", "co-ord", "sage"],
    isFeatured: true,
    variants: [...sizes("Sage", [2, 4, 3, 1]), ...sizes("Ivory", [1, 2, 2, 0])],
  },
  {
    title: "Printed Kurti Pack (Wholesale)",
    category: "kurtis",
    price: 299900,
    mrp: null,
    fabric: "Cotton",
    care: "Hand wash.",
    description: "Set of 3 assorted printed kurtis. Ideal for resellers. Minimum 2 sets.",
    tags: ["wholesale", "pack", "cotton"],
    isFeatured: false,
    moq: 2,
    packSize: 3,
    variants: [{ size: "Assorted", colour: "Assorted", stock: 20 }],
  },
];

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function add(): Promise<void> {
  const categoryIds = new Map<string, mongoose.Types.ObjectId>();
  for (const c of categories) {
    const existing = await Category.findOne({ slug: c.slug });
    const doc =
      existing ?? (await Category.create({ ...c, description: `${DEMO_MARK} ${c.name}` }));
    categoryIds.set(c.slug, doc._id);
  }

  const ids: mongoose.Types.ObjectId[] = [];
  let created = 0;
  for (const p of products) {
    const slug = slugify(p.title);
    const existing = await Product.findOne({ slug });
    if (existing) {
      ids.push(existing._id);
      continue;
    }
    const { category, ...fields } = p;
    const doc = await Product.create({
      ...fields,
      slug,
      categoryId: categoryIds.get(category) ?? null,
      tags: [...p.tags, DEMO_TAG],
    });
    ids.push(doc._id);
    created++;
  }

  if (!(await Catalogue.exists({ slug: "festive-edit" }))) {
    await Catalogue.create({
      name: "Festive Edit",
      slug: "festive-edit",
      description: `${DEMO_MARK} Handpicked for the festive season.`,
      productIds: ids.filter(
        (_, i) => products[i]?.tags.includes("festive") || products[i]?.isFeatured,
      ),
    });
  }
  logger.info({ created, skipped: products.length - created }, "Demo catalogue ready");
}

async function remove(): Promise<void> {
  const demoMark = new RegExp(`^\\${DEMO_MARK}`);
  const productResult = await Product.deleteMany({ tags: DEMO_TAG });
  const catalogueResult = await Catalogue.deleteMany({ description: demoMark });
  const categoryResult = await Category.deleteMany({ description: demoMark });
  logger.info(
    {
      products: productResult.deletedCount,
      catalogues: catalogueResult.deletedCount,
      categories: categoryResult.deletedCount,
    },
    "Demo data removed",
  );
}

async function main(): Promise<void> {
  await connectDb({ uri: env.MONGODB_URI, dbName: env.MONGODB_DB_NAME, autoIndex: false }, logger);
  if (process.argv.includes("--remove")) await remove();
  else await add();
  // Ask the running web app to refresh its cached storefront data.
  createRevalidator(env.WEB_INTERNAL_URL, env.REVALIDATE_SECRET, logger)();
  await new Promise((resolve) => setTimeout(resolve, 1500));
}

main()
  .catch((err: unknown) => {
    logger.fatal({ err }, "Demo script failed");
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());

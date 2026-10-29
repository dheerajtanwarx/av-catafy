import type { FilterQuery, Types } from "mongoose";
import {
  passcodeVerifier,
  passcodeVersion,
  type AccessGrants,
  type AccessVerifier,
} from "../lib/catalogue-access.js";
import { AppError } from "../lib/errors.js";
import { Catalogue, type ProductDoc } from "../models/index.js";

type CatalogueAccessLean = {
  _id: Types.ObjectId;
  slug: string;
  name: string;
  isActive: boolean;
  isPrivate: boolean;
  hidePrices: boolean;
  passcode: string | null;
  productIds: Types.ObjectId[];
};

/** What this buyer may see, computed from catalogue membership and their unlocked catalogues. */
export interface Restrictions {
  /** Products this buyer may not see at all. */
  hidden: Types.ObjectId[];
  /** Visible products whose price is on request → an active catalogue whose passcode reveals it. */
  priceLocked: Map<string, { slug: string; name: string } | null>;
  /** Restricted catalogues this buyer has a valid (current-passcode) grant for. */
  unlocked: Set<string>;
}

/** The base rule: active and not deleted. Restrictions narrow it further. */
export const VISIBLE_PRODUCT: FilterQuery<ProductDoc> = { isActive: true, deletedAt: null };

export function isRestricted(c: { isPrivate: boolean; hidePrices: boolean }): boolean {
  return c.isPrivate || c.hidePrices;
}

/** A grant only counts while the catalogue is active and its passcode hasn't changed. */
export function hasValidGrant(c: CatalogueAccessLean, grants: AccessGrants): boolean {
  const version = grants[c._id.toString()];
  return Boolean(c.isActive && c.passcode && version === passcodeVersion(c.passcode));
}

/**
 * A product takes the least restrictive access of the catalogues it belongs to:
 * - in any active open catalogue, or in no catalogue at all → visible with price;
 * - else in a price-on-request catalogue → visible, price hidden;
 * - else only in private catalogues → hidden.
 * An unlocked catalogue counts as open for this buyer. Inactive restricted catalogues still
 * restrict, so deactivating one never leaks its products.
 */
export async function resolveRestrictions(grants: AccessGrants): Promise<Restrictions> {
  const catalogues = await Catalogue.find({
    $or: [{ isActive: true }, { isPrivate: true }, { hidePrices: true }],
  })
    .select("+passcode slug name isActive isPrivate hidePrices productIds")
    .lean<CatalogueAccessLean[]>();

  const open = new Set<string>();
  const unlocked = new Set<string>();
  for (const c of catalogues) {
    const restricted = isRestricted(c);
    if (restricted && hasValidGrant(c, grants)) unlocked.add(c._id.toString());
    if ((c.isActive && !restricted) || unlocked.has(c._id.toString())) {
      for (const id of c.productIds) open.add(id.toString());
    }
  }

  const priceLocked: Restrictions["priceLocked"] = new Map();
  const privateOnly = new Map<string, Types.ObjectId>();
  for (const c of catalogues) {
    if (!isRestricted(c) || unlocked.has(c._id.toString())) continue;
    for (const id of c.productIds) {
      const key = id.toString();
      if (open.has(key)) continue;
      if (c.isPrivate) {
        privateOnly.set(key, id);
      } else if (c.isActive) {
        priceLocked.set(key, { slug: c.slug, name: c.name });
      } else if (!priceLocked.has(key)) {
        priceLocked.set(key, null); // no active catalogue to unlock it from
      }
    }
  }
  const hidden = [...privateOnly].filter(([key]) => !priceLocked.has(key)).map(([, id]) => id);
  return { hidden, priceLocked, unlocked };
}

/** Filter for products this buyer may see. */
export function visibleProductFilter(r: Restrictions): FilterQuery<ProductDoc> {
  return r.hidden.length ? { ...VISIBLE_PRODUCT, _id: { $nin: r.hidden } } : VISIBLE_PRODUCT;
}

/**
 * Checks a passcode for an active restricted catalogue and returns the buyer's grants with this
 * catalogue added (grants for catalogues whose passcode has since changed are dropped).
 */
export async function unlockCatalogue(
  slug: string,
  credential: string,
  grants: AccessGrants,
  verifier: AccessVerifier = passcodeVerifier,
): Promise<AccessGrants> {
  const c = await Catalogue.findOne({ slug, isActive: true })
    .select("+passcode slug name isActive isPrivate hidePrices productIds")
    .lean<CatalogueAccessLean>();
  if (!c) throw AppError.notFound("Catalogue not found");
  if (!isRestricted(c)) return grants;
  if (!verifier.verify(c, credential)) {
    throw AppError.forbidden("That passcode doesn't match. Please check and try again.");
  }
  return { ...grants, [c._id.toString()]: passcodeVersion(c.passcode!) };
}

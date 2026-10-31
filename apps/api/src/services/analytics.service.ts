import {
  LIVE_WINDOW_MINUTES,
  type AnalyticsEventType,
  type DeviceType,
  type LiveSnapshot,
  type LiveVisitor,
  type ReportsDto,
  type reportsQuerySchema,
  type TrackEventInput,
} from "@catafy/types";
import { Types } from "mongoose";
import type { z } from "zod";
import {
  AnalyticsEvent,
  Catalogue,
  Order,
  Product,
  type AnalyticsEventDoc,
} from "../models/index.js";

type ReportsQuery = z.output<typeof reportsQuerySchema>;
type EventLean = AnalyticsEventDoc & { createdAt: Date };

const BOT =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|headless|curl|wget|python|axios|node-fetch/i;

/** Coarse device class from the User-Agent; nothing else about the browser is kept. */
export function deviceFromUserAgent(ua: string): DeviceType {
  if (/ipad|tablet|kindle|silk|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android|blackberry|opera mini/i.test(ua)) return "mobile";
  return "desktop";
}

export function isBot(ua: string): boolean {
  return !ua || BOT.test(ua);
}

/**
 * Stores one storefront event. Slugs and order tokens are resolved here, so ids in the
 * collection always point at real records; events for unknown pages are dropped silently.
 */
export async function recordEvent(
  input: Omit<TrackEventInput, "referrer"> & { referrer: string },
  userAgent: string,
): Promise<void> {
  if (isBot(userAgent)) return;
  let productId: Types.ObjectId | null = null;
  let catalogueId: Types.ObjectId | null = null;
  let orderId: Types.ObjectId | null = null;

  if (input.type === "product_view") {
    if (!input.productSlug) return;
    const p = await Product.findOne({ slug: input.productSlug }).select("_id").lean();
    if (!p) return;
    productId = p._id;
  } else if (input.type === "add_to_cart") {
    if (!input.productId) return;
    if (!(await Product.exists({ _id: input.productId }))) return;
    productId = new Types.ObjectId(input.productId);
  } else if (input.type === "catalogue_view") {
    if (!input.catalogueSlug) return;
    const c = await Catalogue.findOne({ slug: input.catalogueSlug }).select("_id").lean();
    if (!c) return;
    catalogueId = c._id;
  } else if (input.type === "order_placed") {
    if (!input.orderToken) return;
    const o = await Order.findOne({ publicToken: input.orderToken }).select("_id").lean();
    if (!o) return;
    // Revisiting the confirmation page must not count the order twice.
    if (await AnalyticsEvent.exists({ type: "order_placed", orderId: o._id })) return;
    orderId = o._id;
  }

  await AnalyticsEvent.create({
    type: input.type,
    visitorId: input.visitorId,
    sessionId: input.sessionId,
    path: input.path,
    productId,
    catalogueId,
    orderId,
    referrer: input.referrer.toLowerCase(),
    device: deviceFromUserAgent(userAgent),
  });
}

// ---------- Live visitors ----------

/** Events that mean "the visitor is now on this page" (add_to_cart happens on a page). */
const PAGE_EVENTS = new Set<AnalyticsEventType>([
  "page_view",
  "product_view",
  "catalogue_view",
  "checkout_started",
  "order_placed",
]);

function pageLabel(e: EventLean, products: Map<string, string>, catalogues: Map<string, string>) {
  if (e.productId) return products.get(e.productId.toString()) ?? e.path;
  if (e.catalogueId) return `Catalogue: ${catalogues.get(e.catalogueId.toString()) ?? e.path}`;
  if (e.type === "checkout_started") return "Checkout";
  if (e.type === "order_placed") return "Order placed";
  if (e.path === "/") return "Home";
  if (e.path.startsWith("/products")) return "Shop";
  if (e.path.startsWith("/cart")) return "Bag";
  return e.path;
}

export async function getLiveSnapshot(now = new Date()): Promise<LiveSnapshot> {
  const since = new Date(now.getTime() - LIVE_WINDOW_MINUTES * 60 * 1000);
  const events = await AnalyticsEvent.find({ createdAt: { $gte: since } })
    .sort({ createdAt: 1 })
    .limit(10_000)
    .lean<EventLean[]>();

  const [products, catalogues] = await Promise.all([
    Product.find({ _id: { $in: events.flatMap((e) => (e.productId ? [e.productId] : [])) } })
      .select("title")
      .lean<{ _id: Types.ObjectId; title: string }[]>(),
    Catalogue.find({ _id: { $in: events.flatMap((e) => (e.catalogueId ? [e.catalogueId] : [])) } })
      .select("name")
      .lean<{ _id: Types.ObjectId; name: string }[]>(),
  ]);
  const productTitles = new Map(products.map((p) => [p._id.toString(), p.title]));
  const catalogueNames = new Map(catalogues.map((c) => [c._id.toString(), c.name]));

  const byVisitor = new Map<string, EventLean[]>();
  for (const e of events) byVisitor.set(e.visitorId, [...(byVisitor.get(e.visitorId) ?? []), e]);

  const visitors: LiveVisitor[] = [];
  for (const [visitorId, list] of byVisitor) {
    const pages = list.filter((e) => PAGE_EVENTS.has(e.type));
    const current = pages.at(-1) ?? list.at(-1)!;
    visitors.push({
      visitorId,
      device: current.device,
      referrer: list.find((e) => e.referrer)?.referrer ?? "",
      page: {
        type: current.type,
        path: current.path,
        label: pageLabel(current, productTitles, catalogueNames),
      },
      pageSince: current.createdAt.toISOString(),
      lastSeen: list.at(-1)!.createdAt.toISOString(),
      pagesViewed: pages.length,
      addedToCart: list.some((e) => e.type === "add_to_cart"),
      checkingOut: current.type === "checkout_started",
    });
  }
  visitors.sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
  return { at: now.toISOString(), visitors };
}

// ---------- Reports ----------

export const STORE_TIME_ZONE = "Asia/Kolkata";
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_DAYS: Record<ReportsQuery["range"], number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

/** "YYYY-MM-DD" of the IST calendar day containing `d`. */
function istDay(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** First IST day of the period containing `day` (weeks start on Monday). */
function periodStart(day: string, granularity: ReportsQuery["granularity"]): string {
  if (granularity === "month") return `${day.slice(0, 7)}-01`;
  if (granularity === "day") return day;
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function nextPeriod(start: string, granularity: ReportsQuery["granularity"]): string {
  const d = new Date(`${start}T00:00:00Z`);
  if (granularity === "month") d.setUTCMonth(d.getUTCMonth() + 1);
  else d.setUTCDate(d.getUTCDate() + (granularity === "week" ? 7 : 1));
  return d.toISOString().slice(0, 10);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function periodLabel(start: string, granularity: ReportsQuery["granularity"]): string {
  const [y, m, d] = start.split("-").map(Number) as [number, number, number];
  if (granularity === "month") return `${MONTHS[m - 1]} ${y}`;
  return `${d} ${MONTHS[m - 1]}`;
}

/** MongoDB expression: the period key ("YYYY-MM-DD", IST) of a date field. */
function periodKey(field: string, granularity: ReportsQuery["granularity"]) {
  return {
    $dateToString: {
      format: "%Y-%m-%d",
      timezone: STORE_TIME_ZONE,
      date: {
        $dateTrunc: {
          date: field,
          unit: granularity,
          timezone: STORE_TIME_ZONE,
          ...(granularity === "week" ? { startOfWeek: "monday" } : {}),
        },
      },
    },
  };
}

const FUNNEL: { step: ReportsDto["funnel"][number]["step"]; label: string }[] = [
  { step: "visit", label: "Visited" },
  { step: "product_view", label: "Viewed a product" },
  { step: "add_to_cart", label: "Added to bag" },
  { step: "checkout_started", label: "Started checkout" },
  { step: "order_placed", label: "Placed an order" },
];

export async function getReports(query: ReportsQuery, now = new Date()): Promise<ReportsDto> {
  const days = RANGE_DAYS[query.range];
  const today = istDay(now);
  const firstDay = istDay(new Date(new Date(`${today}T00:00:00Z`).getTime() - (days - 1) * DAY_MS));
  const from = new Date(new Date(`${firstDay}T00:00:00Z`).getTime() - IST_OFFSET_MS);
  const inRange = { createdAt: { $gte: from, $lte: now } };
  const liveOrders = { ...inRange, status: { $ne: "CANCELLED" } };

  const [eventTotals, sessionSteps, eventSeries, orderSeries, productEvents, productSales] =
    await Promise.all([
      AnalyticsEvent.aggregate<{ visitors: number; sessions: number; productViews: number }>([
        { $match: inRange },
        {
          $group: {
            _id: null,
            visitors: { $addToSet: "$visitorId" },
            sessions: { $addToSet: "$sessionId" },
            productViews: { $sum: { $cond: [{ $eq: ["$type", "product_view"] }, 1, 0] } },
          },
        },
        {
          $project: {
            visitors: { $size: "$visitors" },
            sessions: { $size: "$sessions" },
            productViews: 1,
          },
        },
      ]),
      AnalyticsEvent.aggregate<{ _id: AnalyticsEventType; sessions: number }>([
        { $match: inRange },
        { $group: { _id: { type: "$type", session: "$sessionId" } } },
        { $group: { _id: "$_id.type", sessions: { $sum: 1 } } },
      ]),
      AnalyticsEvent.aggregate<{ _id: string; visitors: number }>([
        { $match: inRange },
        {
          $group: { _id: { period: periodKey("$createdAt", query.granularity), v: "$visitorId" } },
        },
        { $group: { _id: "$_id.period", visitors: { $sum: 1 } } },
      ]),
      Order.aggregate<{ _id: string; orders: number; revenue: number }>([
        { $match: liveOrders },
        {
          $group: {
            _id: periodKey("$createdAt", query.granularity),
            orders: { $sum: 1 },
            revenue: { $sum: "$total" },
          },
        },
      ]),
      AnalyticsEvent.aggregate<{ _id: Types.ObjectId; views: number; addToCarts: number }>([
        { $match: { ...inRange, productId: { $ne: null } } },
        {
          $group: {
            _id: "$productId",
            views: { $sum: { $cond: [{ $eq: ["$type", "product_view"] }, 1, 0] } },
            addToCarts: { $sum: { $cond: [{ $eq: ["$type", "add_to_cart"] }, 1, 0] } },
          },
        },
      ]),
      Order.aggregate<{
        _id: Types.ObjectId;
        title: string;
        slug: string;
        units: number;
        revenue: number;
      }>([
        { $match: liveOrders },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.productId",
            title: { $last: "$items.title" },
            slug: { $last: "$items.slug" },
            units: { $sum: "$items.quantity" },
            revenue: { $sum: "$items.lineTotal" },
          },
        },
      ]),
    ]);

  // Orders and revenue come from the orders collection, so they're exact even if a buyer's
  // browser blocked the tracking call.
  const orderCount = orderSeries.reduce((s, o) => s + o.orders, 0);
  const revenue = orderSeries.reduce((s, o) => s + o.revenue, 0);
  const totals = eventTotals[0] ?? { visitors: 0, sessions: 0, productViews: 0 };
  const steps = new Map(sessionSteps.map((s) => [s._id, s.sessions]));
  const ordered = steps.get("order_placed") ?? 0;

  // Series with every period present, oldest first.
  const ordersBy = new Map(orderSeries.map((o) => [o._id, o]));
  const visitorsBy = new Map(eventSeries.map((e) => [e._id, e.visitors]));
  const series: ReportsDto["series"] = [];
  for (
    let p = periodStart(firstDay, query.granularity);
    p <= today;
    p = nextPeriod(p, query.granularity)
  ) {
    series.push({
      period: p,
      label: periodLabel(p, query.granularity),
      orders: ordersBy.get(p)?.orders ?? 0,
      revenue: ordersBy.get(p)?.revenue ?? 0,
      visitors: visitorsBy.get(p) ?? 0,
    });
  }

  // Top products: anything viewed or sold, ranked by revenue, then views.
  const rows = new Map<string, ReportsDto["topProducts"][number]>();
  const row = (id: Types.ObjectId) => {
    const key = id.toString();
    const r = rows.get(key) ?? {
      productId: key,
      title: "",
      slug: "",
      views: 0,
      addToCarts: 0,
      unitsSold: 0,
      revenue: 0,
    };
    rows.set(key, r);
    return r;
  };
  for (const e of productEvents)
    Object.assign(row(e._id), { views: e.views, addToCarts: e.addToCarts });
  for (const s of productSales) {
    Object.assign(row(s._id), {
      title: s.title,
      slug: s.slug,
      unitsSold: s.units,
      revenue: s.revenue,
    });
  }
  const top = [...rows.values()]
    .sort((a, b) => b.revenue - a.revenue || b.views - a.views || b.addToCarts - a.addToCarts)
    .slice(0, 10);
  // Current titles where the product still exists; order snapshots otherwise.
  const current = await Product.find({ _id: { $in: top.map((t) => t.productId) } })
    .select("title slug")
    .lean<{ _id: Types.ObjectId; title: string; slug: string }[]>();
  for (const p of current)
    Object.assign(rows.get(p._id.toString())!, { title: p.title, slug: p.slug });

  return {
    range: { from: from.toISOString(), to: now.toISOString() },
    totals: {
      visitors: totals.visitors,
      sessions: totals.sessions,
      productViews: totals.productViews,
      orders: orderCount,
      revenue,
      conversionRate: totals.sessions ? Math.min(1, ordered / totals.sessions) : 0,
    },
    funnel: FUNNEL.map(({ step, label }) => ({
      step,
      label,
      sessions: step === "visit" ? totals.sessions : (steps.get(step) ?? 0),
    })),
    series,
    topProducts: top.filter((t) => t.title),
  };
}

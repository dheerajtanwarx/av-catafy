import { z } from "zod";
import { objectIdSchema, slugSchema } from "./common.js";
import { ANALYTICS_EVENT_TYPES, type AnalyticsEventType, type DeviceType } from "./enums.js";

/** Random ids the browser keeps in localStorage; never linked to a person. */
const anonymousId = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, "Invalid id");

/**
 * One storefront event. The API resolves slugs/tokens to ids, derives the device type from the
 * User-Agent and never stores the IP address.
 */
export const trackEventInputSchema = z.object({
  type: z.enum(ANALYTICS_EVENT_TYPES),
  visitorId: anonymousId,
  sessionId: anonymousId,
  path: z.string().startsWith("/").max(300),
  /** External referrer hostname only (e.g. "l.instagram.com"), or "". */
  referrer: z
    .string()
    .max(200)
    .regex(/^[a-z0-9.-]*$/i)
    .default(""),
  productSlug: slugSchema.optional(),
  productId: objectIdSchema.optional(),
  catalogueSlug: slugSchema.optional(),
  orderToken: z
    .string()
    .regex(/^[A-Za-z0-9_-]{24}$/)
    .optional(),
});
export type TrackEventInput = z.input<typeof trackEventInputSchema>;

/** Visitors seen in this window count as live. */
export const LIVE_WINDOW_MINUTES = 5;

export interface LiveVisitor {
  visitorId: string;
  device: DeviceType;
  referrer: string;
  /** What they're looking at now. */
  page: { type: AnalyticsEventType; path: string; label: string };
  /** When they opened the current page. */
  pageSince: string;
  lastSeen: string;
  pagesViewed: number;
  addedToCart: boolean;
  checkingOut: boolean;
}

export interface LiveSnapshot {
  at: string;
  visitors: LiveVisitor[];
}

export const REPORT_RANGES = ["7d", "30d", "90d", "365d"] as const;
export const REPORT_GRANULARITIES = ["day", "week", "month"] as const;

export const reportsQuerySchema = z.object({
  range: z.enum(REPORT_RANGES).default("30d"),
  granularity: z.enum(REPORT_GRANULARITIES).default("day"),
});
export type ReportsQuery = z.input<typeof reportsQuerySchema>;

export interface ReportsDto {
  range: { from: string; to: string };
  totals: {
    visitors: number;
    sessions: number;
    productViews: number;
    orders: number;
    /** Paise; order totals excluding cancelled orders. */
    revenue: number;
    /** Sessions that placed an order ÷ sessions, 0–1. */
    conversionRate: number;
  };
  /** Distinct sessions reaching each step. */
  funnel: { step: AnalyticsEventType | "visit"; label: string; sessions: number }[];
  /** One entry per day/week/month (IST), oldest first, gaps filled with zeros. */
  series: { period: string; label: string; orders: number; revenue: number; visitors: number }[];
  topProducts: {
    productId: string;
    title: string;
    slug: string;
    views: number;
    addToCarts: number;
    unitsSold: number;
    revenue: number;
  }[];
}

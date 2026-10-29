"use client";

import type { TrackEventInput } from "@catafy/types";

const VISITOR_KEY = "catafy-visitor";
const SESSION_KEY = "catafy-session";
/** A visit ends after 30 minutes without activity (the usual analytics convention). */
const SESSION_IDLE_MS = 30 * 60 * 1000;

function randomId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** Anonymous ids; if storage is blocked we still send events with throwaway ids. */
function ids(): { visitorId: string; sessionId: string } {
  try {
    let visitorId = localStorage.getItem(VISITOR_KEY);
    if (!visitorId) {
      visitorId = randomId();
      localStorage.setItem(VISITOR_KEY, visitorId);
    }
    const now = Date.now();
    const stored = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as {
      id: string;
      at: number;
    } | null;
    const sessionId = stored && now - stored.at < SESSION_IDLE_MS ? stored.id : randomId();
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id: sessionId, at: now }));
    return { visitorId, sessionId };
  } catch {
    return { visitorId: randomId(), sessionId: randomId() };
  }
}

/** External referrer hostname, e.g. "l.instagram.com"; "" for our own pages or none. */
function referrer(): string {
  try {
    const host = document.referrer ? new URL(document.referrer).hostname : "";
    return host && host !== window.location.hostname ? host : "";
  } catch {
    return "";
  }
}

type Extra = Pick<TrackEventInput, "productSlug" | "productId" | "catalogueSlug" | "orderToken">;

/** Fire-and-forget: analytics must never slow down or break the storefront. */
export function track(type: TrackEventInput["type"], extra: Extra = {}): void {
  const body: TrackEventInput = {
    type,
    ...ids(),
    path: window.location.pathname.slice(0, 300),
    referrer: referrer(),
    ...extra,
  };
  void fetch("/api/v1/public/events", {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => undefined);
}

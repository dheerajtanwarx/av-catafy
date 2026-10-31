"use client";

import { LIVE_WINDOW_MINUTES, type DeviceType, type LiveVisitor } from "@catafy/types";
import { Monitor, Radio, ShoppingBag, Smartphone, Tablet } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { LIVE_POLL_MS, useLive } from "@/lib/queries";

const DEVICE_ICON: Record<DeviceType, typeof Smartphone> = {
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
};

/** "2m 05s"; ticks every second between polls. */
function duration(fromIso: string, now: number): string {
  const s = Math.max(0, Math.floor((now - Date.parse(fromIso)) / 1000));
  const m = Math.floor(s / 60);
  return m ? `${m}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

/** Friendly source names for the referrers buyers usually arrive from. */
function source(referrer: string): string {
  if (!referrer) return "Direct / WhatsApp app";
  if (/(^|\.)(wa\.me|whatsapp\.com)$/.test(referrer)) return "WhatsApp";
  if (/instagram\.com$/.test(referrer)) return "Instagram";
  if (/facebook\.com$|fb\.me$/.test(referrer)) return "Facebook";
  if (/google\./.test(referrer)) return "Google";
  return referrer;
}

function VisitorRow({ v, now }: { v: LiveVisitor; now: number }) {
  const Icon = DEVICE_ICON[v.device];
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
      <Icon className="size-5 shrink-0 text-muted-foreground" aria-label={v.device} />
      <div className="min-w-0 flex-1">
        <a
          href={v.page.path}
          target="_blank"
          rel="noreferrer"
          className="block truncate font-medium hover:underline"
        >
          {v.page.label}
        </a>
        <p className="text-xs text-muted-foreground">
          {source(v.referrer)} · {v.pagesViewed} page{v.pagesViewed === 1 ? "" : "s"} in the last{" "}
          {LIVE_WINDOW_MINUTES} min
        </p>
      </div>
      <div className="flex items-center gap-2">
        {v.checkingOut ? (
          <Badge className="bg-emerald-100 text-emerald-900">Checking out</Badge>
        ) : v.addedToCart ? (
          <Badge variant="secondary">
            <ShoppingBag aria-hidden />
            Bag
          </Badge>
        ) : null}
        <span className="w-20 text-right text-sm tabular-nums" title="Time on this page">
          {duration(v.pageSince, now)}
        </span>
      </div>
    </li>
  );
}

export default function LivePage() {
  const { data, isLoading, isError, error, dataUpdatedAt } = useLive();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const count = data?.visitors.length ?? 0;

  return (
    <>
      <PageHeader
        title="Live"
        description={`Visitors active in the last ${LIVE_WINDOW_MINUTES} minutes. Updates every ${LIVE_POLL_MS / 1000} seconds.`}
      />

      <div className="mb-6 flex items-center gap-4">
        <span className="relative flex size-3" aria-hidden>
          {count > 0 && (
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
          )}
          <span
            className={`relative inline-flex size-3 rounded-full ${count > 0 ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
          />
        </span>
        {isLoading ? (
          <Skeleton className="h-12 w-24" />
        ) : (
          <p aria-live="polite">
            <span className="text-5xl font-semibold">{count}</span>
            <span className="ml-2 text-muted-foreground">
              {count === 1 ? "visitor" : "visitors"} now
            </span>
          </p>
        )}
      </div>

      <Card className="py-0">
        {isError ? (
          <p className="p-6 text-sm text-destructive">{errorMessage(error)}</p>
        ) : isLoading ? (
          <Skeleton className="m-4 h-40" />
        ) : count === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <Radio className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">Nobody on the store right now</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Share a product or catalogue link on WhatsApp and visitors appear here within seconds.
              Your own visits while logged in aren&apos;t counted.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {data?.visitors.map((v) => (
              <VisitorRow key={v.visitorId} v={v} now={Math.max(now, dataUpdatedAt)} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

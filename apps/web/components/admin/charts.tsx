"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Single series, validated against the white card surface (dataviz validator: all checks pass). */
const SERIES = "#2a78d6";

/** 1, 2 or 5 × 10ⁿ: ticks land on round numbers. */
function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

export interface ColumnDatum {
  key: string;
  label: string;
  value: number;
}

/**
 * Column chart for one measure over time. Columns grow from one baseline, are capped at 24px wide
 * and have 4px rounded tops; hover or focus a column for its exact value. A table view carries
 * the same numbers for screen readers and anyone who prefers them.
 */
export function ColumnChart({
  data,
  format,
  formatTick = format,
  title,
}: {
  data: ColumnDatum[];
  format: (v: number) => string;
  formatTick?: (v: number) => string;
  title: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(0, ...data.map((d) => d.value));
  const step = niceStep(max / 4);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  // Label at most ~6 periods on the x-axis; the tooltip names every column.
  const every = Math.max(1, Math.ceil(data.length / 6));
  const current = active === null ? null : data[active];

  return (
    <figure className="space-y-3">
      <div className="relative flex h-56 gap-3">
        {/* Y axis: tick labels in muted ink, hairline grid. */}
        <div className="relative w-12 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
          {ticks.map((t) => (
            <span
              key={t}
              // Centre the label on its gridline.
              className="absolute right-0 translate-y-1/2"
              style={{ bottom: `${(t / top) * 100}%` }}
            >
              {formatTick(t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1" onMouseLeave={() => setActive(null)}>
          {ticks.map((t) => (
            <div
              key={t}
              className="pointer-events-none absolute inset-x-0 border-t border-border"
              style={{ bottom: `${(t / top) * 100}%` }}
              aria-hidden
            />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]" role="list" aria-label={title}>
            {data.map((d, i) => (
              <button
                key={d.key}
                type="button"
                role="listitem"
                aria-label={`${d.label}: ${format(d.value)}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                // The whole band is the hit target, not just the (possibly tiny) column.
                className="group flex h-full min-w-0 flex-1 items-end justify-center focus-visible:outline-none"
              >
                <span
                  className={cn(
                    "block w-full max-w-6 rounded-t-[4px] transition-opacity",
                    active !== null && active !== i && "opacity-40",
                    "group-focus-visible:ring-2 group-focus-visible:ring-ring",
                  )}
                  style={{
                    height: d.value ? `max(2px, ${(d.value / top) * 100}%)` : 0,
                    background: SERIES,
                  }}
                />
              </button>
            ))}
          </div>
          {current && active !== null && (
            <div
              role="status"
              className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-md border bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap shadow-sm"
              style={{
                left: `clamp(3rem, ${((active + 0.5) / data.length) * 100}%, calc(100% - 3rem))`,
              }}
            >
              <span className="text-muted-foreground">{current.label}</span>{" "}
              <span className="font-medium tabular-nums">{format(current.value)}</span>
            </div>
          )}
        </div>
      </div>
      <div className="ml-15 flex gap-[2px] text-xs text-muted-foreground" aria-hidden>
        {data.map((d, i) => (
          <span
            key={d.key}
            className="min-w-0 flex-1 overflow-visible text-center whitespace-nowrap"
          >
            {i % every === 0 ? d.label : ""}
          </span>
        ))}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          View as table
        </summary>
        <table className="mt-2 w-full max-w-sm text-left">
          <caption className="sr-only">{title}</caption>
          <tbody>
            {data.map((d) => (
              <tr key={d.key} className="border-b last:border-0">
                <th scope="row" className="py-1 font-normal text-muted-foreground">
                  {d.label}
                </th>
                <td className="py-1 text-right tabular-nums">{format(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Funnel as horizontal bars from one baseline; each step shows its count and share of visits. */
export function FunnelBars({ steps }: { steps: { label: string; sessions: number }[] }) {
  const base = steps[0]?.sessions ?? 0;
  return (
    <ol className="space-y-3">
      {steps.map((s) => {
        const share = base ? s.sessions / base : 0;
        return (
          <li key={s.label} className="space-y-1 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="tabular-nums">
                {s.sessions.toLocaleString("en-IN")}
                {base > 0 && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {Math.round(share * 100)}%
                  </span>
                )}
              </span>
            </div>
            {/* Full-width track so steps compare on the same scale even in a narrow card. */}
            <div className="h-2.5 w-full">
              <div
                className="h-full rounded-r-[4px]"
                style={{ width: s.sessions ? `max(2px, ${share * 100}%)` : 0, background: SERIES }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

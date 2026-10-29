"use client";

import { formatPaise, REPORT_RANGES, type ReportsDto, type ReportsQuery } from "@catafy/types";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ColumnChart, FunnelBars } from "@/components/admin/charts";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { errorMessage } from "@/lib/api";
import { useReports } from "@/lib/queries";
import { cn } from "@/lib/utils";

type Range = NonNullable<ReportsQuery["range"]>;
type Granularity = NonNullable<ReportsQuery["granularity"]>;
type Metric = "revenue" | "orders" | "visitors";

const RANGE_LABEL: Record<Range, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "365d": "Last 12 months",
};
const METRIC_LABEL: Record<Metric, string> = {
  revenue: "Revenue",
  orders: "Orders",
  visitors: "Visitors",
};

const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });
const rupeesCompact = (paise: number) => `₹${compact.format(paise / 100)}`;
const count = (n: number) => n.toLocaleString("en-IN");

function Stat({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <Card className="py-4">
      <CardContent className="px-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-semibold">{children}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded px-3 py-1 text-sm transition-colors disabled:opacity-40",
            value === o.value
              ? "bg-background font-medium shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TopProducts({ rows }: { rows: ReportsDto["topProducts"] }) {
  if (!rows.length) {
    return (
      <p className="px-6 pb-6 text-sm text-muted-foreground">No product views or sales yet.</p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">Product</TableHead>
          <TableHead className="text-right">Views</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Added to bag</TableHead>
          <TableHead className="text-right">Sold</TableHead>
          <TableHead className="pr-6 text-right">Revenue</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((p) => (
          <TableRow key={p.productId}>
            <TableCell className="max-w-[16rem] truncate pl-6">
              <Link href={`/admin/products/${p.productId}`} className="hover:underline">
                {p.title}
              </Link>
            </TableCell>
            <TableCell className="text-right tabular-nums">{count(p.views)}</TableCell>
            <TableCell className="hidden text-right tabular-nums sm:table-cell">
              {count(p.addToCarts)}
            </TableCell>
            <TableCell className="text-right tabular-nums">{count(p.unitsSold)}</TableCell>
            <TableCell className="pr-6 text-right tabular-nums">{formatPaise(p.revenue)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function ReportsPage() {
  const [range, setRange] = useState<Range>("30d");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [metric, setMetric] = useState<Metric>("revenue");
  // A year of daily columns is unreadable; a year starts at weekly.
  const effective: Granularity = range === "365d" && granularity === "day" ? "week" : granularity;
  const { data, isLoading, isError, error, isFetching } = useReports({
    range,
    granularity: effective,
  });

  const format = metric === "revenue" ? (v: number) => formatPaise(v) : count;
  const formatTick = metric === "revenue" ? rupeesCompact : (v: number) => compact.format(v);

  return (
    <>
      <PageHeader
        title="Reports"
        description="Orders and revenue come from your orders (cancelled ones excluded). Visits come from the storefront, in Indian time."
        actions={
          <Select value={range} onValueChange={(v) => setRange(v as Range)}>
            <SelectTrigger className="w-44" aria-label="Date range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPORT_RANGES.map((r) => (
                <SelectItem key={r} value={r}>
                  {RANGE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {isError ? (
        <p className="text-destructive">{errorMessage(error)}</p>
      ) : isLoading || !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-80" />
        </div>
      ) : (
        <div className={cn("space-y-6", isFetching && "opacity-70 transition-opacity")}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Revenue">{formatPaise(data.totals.revenue)}</Stat>
            <Stat label="Orders">{count(data.totals.orders)}</Stat>
            <Stat label="Visitors" hint={`${count(data.totals.sessions)} visits`}>
              {count(data.totals.visitors)}
            </Stat>
            <Stat label="Conversion" hint="Visits that placed an order">
              {(data.totals.conversionRate * 100).toFixed(1)}%
            </Stat>
          </div>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">
                {METRIC_LABEL[metric]} per {effective}
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <Segmented
                  label="Measure"
                  value={metric}
                  onChange={setMetric}
                  options={(["revenue", "orders", "visitors"] as const).map((m) => ({
                    value: m,
                    label: METRIC_LABEL[m],
                  }))}
                />
                <Segmented
                  label="Group by"
                  value={effective}
                  onChange={setGranularity}
                  options={[
                    { value: "day", label: "Day", disabled: range === "365d" },
                    { value: "week", label: "Week" },
                    { value: "month", label: "Month" },
                  ]}
                />
              </div>
            </CardHeader>
            <CardContent>
              <ColumnChart
                title={`${METRIC_LABEL[metric]} per ${effective}`}
                data={data.series.map((s) => ({ key: s.period, label: s.label, value: s[metric] }))}
                format={format}
                formatTick={formatTick}
              />
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Conversion funnel</CardTitle>
                <p className="text-sm text-muted-foreground">Visits reaching each step</p>
              </CardHeader>
              <CardContent>
                <FunnelBars steps={data.funnel} />
              </CardContent>
            </Card>
            <Card className="gap-0">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Top products</CardTitle>
              </CardHeader>
              <TopProducts rows={data.topProducts} />
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

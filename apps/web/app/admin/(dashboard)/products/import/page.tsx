"use client";

import { formatPaise, IMPORT_MAX_ROWS, type ImportProductResult } from "@catafy/types";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Info,
  Loader2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { errorMessage } from "@/lib/api";
import {
  downloadTemplate,
  IMPORT_MAX_BYTES,
  parseImportFile,
  type ImportRows,
} from "@/lib/import-file";
import { useImportProducts } from "@/lib/queries";

const STATUS: Record<ImportProductResult["status"], { label: string; className: string }> = {
  ready: { label: "Ready", className: "bg-sky-100 text-sky-900" },
  invalid: { label: "Needs fixing", className: "bg-red-100 text-red-900" },
  created: { label: "Imported", className: "bg-emerald-100 text-emerald-900" },
  failed: { label: "Failed", className: "bg-red-100 text-red-900" },
};

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-base">
          <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs tabular-nums">
            {n}
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">{children}</CardContent>
    </Card>
  );
}

export default function ImportProductsPage() {
  const input = useRef<HTMLInputElement>(null);
  const run = useImportProducts();
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRows | null>(null);
  /** Problems that stop the upload (red) and harmless notes (muted). */
  const [problems, setProblems] = useState<string[]>([]);
  const [info, setInfo] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [templating, setTemplating] = useState(false);
  const report = run.data;

  async function onTemplate() {
    setTemplating(true);
    try {
      await downloadTemplate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setTemplating(false);
    }
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // choosing the same file again re-runs
    if (!file) return;
    run.reset();
    setRows(null);
    setProblems([]);
    setInfo(null);
    setFileName(file.name);
    if (file.size > IMPORT_MAX_BYTES) {
      setProblems(["The file is larger than 5 MB. Split it into smaller files."]);
      return;
    }
    setParsing(true);
    try {
      const parsed = await parseImportFile(file);
      const found: string[] = [];
      if (parsed.missing.length) {
        found.push(`Missing required columns: ${parsed.missing.join(", ")}.`);
      }
      if (!parsed.rows.length) found.push("No product rows found in the first sheet.");
      if (parsed.rows.length > IMPORT_MAX_ROWS) {
        found.push(`${parsed.rows.length} rows: the limit is ${IMPORT_MAX_ROWS} per file.`);
      }
      setProblems(found);
      if (parsed.ignored.length) {
        setInfo(
          `These columns aren't import columns and were ignored: ${parsed.ignored.join(", ")}.`,
        );
      }
      if (found.length) return;
      setRows(parsed.rows);
      run.mutate({ rows: parsed.rows, commit: false });
    } catch (err) {
      setProblems([`Couldn't read this file: ${errorMessage(err)}`]);
    } finally {
      setParsing(false);
    }
  }

  async function onImport() {
    if (!rows) return;
    try {
      const done = await run.mutateAsync({ rows, commit: true });
      const { created, failed, invalid } = done.summary;
      toast.success(`Imported ${created} product${created === 1 ? "" : "s"}`, {
        description: failed + invalid ? `${failed + invalid} skipped, see below.` : undefined,
      });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const busy = parsing || run.isPending;
  const committed = report?.committed ?? false;

  return (
    <>
      <Link
        href="/admin/products"
        className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Products
      </Link>
      <PageHeader
        title="Import products"
        description="Add many products at once from an Excel or CSV file."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Step n={1} title="Fill in the template">
          <p className="text-muted-foreground">
            One row per size and colour. Rows with the same title become one product. Photos are
            added afterwards from each product&apos;s page.
          </p>
          <Button variant="outline" onClick={onTemplate} disabled={templating}>
            {templating ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Download className="size-4" aria-hidden />
            )}
            Download template (.xlsx)
          </Button>
        </Step>
        <Step n={2} title="Upload and check">
          <p className="text-muted-foreground">
            Nothing is saved until you confirm. Up to {IMPORT_MAX_ROWS} rows, .xlsx or .csv.
          </p>
          <input
            ref={input}
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="sr-only"
            onChange={onFile}
            aria-label="Choose a spreadsheet"
          />
          <Button onClick={() => input.current?.click()} disabled={busy}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="size-4" aria-hidden />
            )}
            {fileName ? "Choose another file" : "Choose file"}
          </Button>
          {fileName && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <FileSpreadsheet className="size-4" aria-hidden />
              {fileName}
            </p>
          )}
        </Step>
      </div>

      {(problems.length > 0 || run.isError) && (
        <div
          role="alert"
          className="mt-4 space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          {problems.map((n) => (
            <p key={n}>{n}</p>
          ))}
          {run.isError && <p>{errorMessage(run.error)}</p>}
        </div>
      )}

      {info && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="size-4 shrink-0" aria-hidden />
          {info}
        </p>
      )}

      {report && (
        <section className="mt-6" aria-labelledby="report-heading">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="report-heading" className="font-display text-2xl">
                {committed ? "Import finished" : "Preview"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {report.summary.rows} rows → {report.summary.products} products.{" "}
                {committed
                  ? `${report.summary.created} imported, ${report.summary.invalid + report.summary.failed} skipped.`
                  : `${report.summary.ready} ready, ${report.summary.invalid} need fixing.`}
                {report.newCategories.length > 0 &&
                  ` ${committed ? "Created" : "New"} categories: ${report.newCategories.join(", ")}.`}
              </p>
            </div>
            {committed ? (
              <Button asChild>
                <Link href="/admin/products">
                  <CheckCircle2 className="size-4" aria-hidden />
                  View products
                </Link>
              </Button>
            ) : (
              <Button onClick={onImport} disabled={run.isPending || report.summary.ready === 0}>
                {run.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Import {report.summary.ready} product{report.summary.ready === 1 ? "" : "s"}
              </Button>
            )}
          </div>
          {!committed && report.summary.invalid > 0 && report.summary.ready > 0 && (
            <p className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="size-4" aria-hidden />
              Products that need fixing are skipped. Fix them in the file and upload it again later;
              already imported products are not duplicated.
            </p>
          )}

          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Product</TableHead>
                  <TableHead className="hidden sm:table-cell">Rows</TableHead>
                  <TableHead className="hidden md:table-cell">Price</TableHead>
                  <TableHead className="hidden md:table-cell">Variants</TableHead>
                  <TableHead className="pr-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.products.map((p) => (
                  <TableRow key={`${p.rows[0]}-${p.title}`} className="align-top">
                    <TableCell className="max-w-[22rem] pl-4 whitespace-normal">
                      <p className="font-medium">{p.title}</p>
                      {p.category && <p className="text-xs text-muted-foreground">{p.category}</p>}
                      {p.issues.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs text-destructive">
                          {p.issues.map((i, n) => (
                            <li key={n}>
                              Row {i.row}
                              {i.column && <span className="font-mono"> · {i.column}</span>}:{" "}
                              {i.message}
                            </li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground tabular-nums sm:table-cell">
                      {p.rows.length > 1 ? `${p.rows[0]}–${p.rows.at(-1)}` : p.rows[0]}
                    </TableCell>
                    <TableCell className="hidden tabular-nums md:table-cell">
                      {p.price === null ? "—" : formatPaise(p.price)}
                    </TableCell>
                    <TableCell className="hidden tabular-nums md:table-cell">
                      {p.variantCount} · {p.totalStock} in stock
                    </TableCell>
                    <TableCell className="pr-4">
                      <Badge className={STATUS[p.status].className}>{STATUS[p.status].label}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </section>
      )}
    </>
  );
}

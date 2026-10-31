import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

export function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  const linkClass =
    "inline-flex items-center gap-1 rounded-full border px-4 py-2 text-sm hover:border-foreground";
  return (
    <nav className="mt-12 flex items-center justify-center gap-3" aria-label="Pagination">
      {page > 1 && (
        <Link href={hrefFor(page - 1)} className={linkClass} rel="prev">
          <ChevronLeft className="size-4" aria-hidden /> Previous
        </Link>
      )}
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      {page < totalPages && (
        <Link href={hrefFor(page + 1)} className={linkClass} rel="next">
          Next <ChevronRight className="size-4" aria-hidden />
        </Link>
      )}
    </nav>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";

export function SectionHeading({
  title,
  href,
  linkLabel = "View all",
}: {
  title: ReactNode;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <h2 className="font-display text-3xl font-medium md:text-4xl">{title}</h2>
      {href && (
        <Link
          href={href}
          className="text-sm whitespace-nowrap underline underline-offset-4 hover:text-brand"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

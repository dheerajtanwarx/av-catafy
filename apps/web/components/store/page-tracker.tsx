"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { track } from "@/lib/analytics";

/** One event per page view, typed from the URL so pages need no tracking code of their own. */
export function PageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const [, section, param] = pathname.split("/");
    const value = param ? decodeURIComponent(param) : undefined;
    if (section === "p" && value) track("product_view", { productSlug: value });
    else if (section === "c" && value) track("catalogue_view", { catalogueSlug: value });
    else if (section === "checkout") track("checkout_started");
    else if (section === "order" && value) track("order_placed", { orderToken: value });
    else track("page_view");
  }, [pathname]);

  return null;
}

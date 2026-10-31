"use client";

import { Check, Copy, MessageCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SITE_URL } from "@/lib/seo";

/** Copy / WhatsApp-share a storefront URL. */
export function ShareLink({ path, text }: { path: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${SITE_URL}${path}`;

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={url}
          readOnly
          aria-label="Share link"
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button type="button" variant="outline" size="icon" onClick={copy} aria-label="Copy link">
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
      <Button type="button" variant="secondary" size="sm" className="w-full" asChild>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle className="size-4" aria-hidden />
          Share on WhatsApp
        </a>
      </Button>
    </div>
  );
}

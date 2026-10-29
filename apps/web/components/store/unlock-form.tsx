"use client";

import { Loader2, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api";

/** Passcode entry for a private or price-on-request catalogue. The API sets an httpOnly cookie. */
export function UnlockForm({ slug, cta = "Unlock" }: { slug: string; cta?: string }) {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const busy = submitting || refreshing;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api(`/public/catalogues/${slug}/unlock`, { method: "POST", body: { passcode } });
      // Re-render the server components, now with the cookie.
      startRefresh(() => router.refresh());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="w-full">
      <label htmlFor={`passcode-${slug}`} className="sr-only">
        Passcode
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <LockKeyhole className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={`passcode-${slug}`}
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Passcode"
            autoComplete="off"
            autoCapitalize="none"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `passcode-${slug}-error` : undefined}
            className="h-11 pl-9"
            maxLength={32}
          />
        </div>
        <Button type="submit" size="lg" className="h-11" disabled={busy || !passcode.trim()}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {cta}
        </Button>
      </div>
      {error && (
        <p id={`passcode-${slug}-error`} role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="font-display text-4xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Owner login and product management arrive in Phase 2.
      </p>
    </main>
  );
}

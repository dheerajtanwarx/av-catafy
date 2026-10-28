import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-center font-display text-4xl font-semibold">Welcome back</h1>
        <p className="mt-2 mb-8 text-center text-sm text-muted-foreground">
          Log in to manage your store.
        </p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}

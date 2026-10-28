"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { loginInputSchema, type LoginInput } from "@catafy/types";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api";

/** Only allow redirects back into the dashboard (no open redirects). */
function safeNext(next: string | null): string {
  return next && next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin";
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginInputSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setError(null);
    try {
      await api("/admin/auth/login", { method: "POST", body: values });
      router.replace(safeNext(params.get("next")));
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="username" autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {error && (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Log in
        </Button>
      </form>
    </Form>
  );
}

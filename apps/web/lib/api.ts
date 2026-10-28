import { errorEnvelopeSchema, type ErrorCode } from "@catafy/types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
}

/** Same-origin call to the Express API through the Next.js /api/v1 rewrite. */
export async function api<T>(
  path: string,
  { method = "GET", body, query, signal }: ApiOptions = {},
) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") search.set(k, String(v));
  }
  const qs = search.size ? `?${search}` : "";

  const res = await fetch(`/api/v1${path}${qs}`, {
    method,
    signal,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const parsed = errorEnvelopeSchema.safeParse(data);
    const error = parsed.success
      ? new ApiError(
          res.status,
          parsed.data.error.code,
          parsed.data.error.message,
          parsed.data.error.details,
        )
      : new ApiError(res.status, "INTERNAL_ERROR", "Something went wrong. Please try again.");

    // Session expired while using the dashboard: send the owner back to login.
    if (res.status === 401 && path.startsWith("/admin") && !path.startsWith("/admin/auth/login")) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.assign(`/admin/login?next=${next}`);
    }
    throw error;
  }
  return data as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

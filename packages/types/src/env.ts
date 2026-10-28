import { z } from "zod";

const url = z.string().url();
const nonEmpty = z.string().min(1);

export const apiEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z
    .string()
    .regex(/^mongodb(\+srv)?:\/\//, "MONGODB_URI must start with mongodb:// or mongodb+srv://"),
  /** Database name; overrides any database in the URI path. */
  MONGODB_DB_NAME: z.string().min(1).default("catafy"),
  WEB_ORIGIN: url,
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  OWNER_EMAIL: z.string().email().optional(),
  OWNER_PASSWORD: z.string().min(10).optional(),
  R2_ACCOUNT_ID: nonEmpty,
  /** S3 API endpoint; defaults to https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com. */
  R2_ENDPOINT: url.optional(),
  R2_ACCESS_KEY_ID: nonEmpty,
  R2_SECRET_ACCESS_KEY: nonEmpty,
  R2_BUCKET: nonEmpty,
  R2_PUBLIC_BASE_URL: url,
  /** Base URL the API uses to call the web app's revalidate endpoint. */
  WEB_INTERNAL_URL: url.optional(),
  REVALIDATE_SECRET: z.string().min(16, "REVALIDATE_SECRET must be at least 16 characters"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});
export type ApiEnv = z.infer<typeof apiEnvSchema>;

export const webEnvSchema = z.object({
  /** Where the Next.js server proxies /api/v1/* to. Never exposed to the browser. */
  API_INTERNAL_URL: url,
  REVALIDATE_SECRET: z.string().min(16),
  /** Same secret as the API; middleware verifies the session cookie before rendering /admin. */
  JWT_SECRET: z.string().min(32),
  NEXT_PUBLIC_SITE_URL: url,
  R2_PUBLIC_BASE_URL: url,
});
export type WebEnv = z.infer<typeof webEnvSchema>;

/** Parse env or throw an Error listing every missing/invalid variable. */
export function parseEnv<T extends z.ZodTypeAny>(
  schema: T,
  source: Record<string, string | undefined>,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map(
      (i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`,
    );
    throw new Error(`Invalid environment variables:\n${lines.join("\n")}`);
  }
  return result.data;
}

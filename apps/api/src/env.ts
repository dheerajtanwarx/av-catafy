import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { apiEnvSchema, parseEnv, type ApiEnv } from "@catafy/types";

// The monorepo keeps a single .env at the repo root (src/ and dist/ sit at the same depth).
const rootEnvFile = fileURLToPath(new URL("../../../.env", import.meta.url));

function loadEnv(): ApiEnv {
  if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);
  try {
    return parseEnv(apiEnvSchema, process.env);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

export const env = loadEnv();
export const isProd = env.NODE_ENV === "production";

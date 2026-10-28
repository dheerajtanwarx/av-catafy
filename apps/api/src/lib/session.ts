import type { SessionUser } from "@catafy/types";
import { jwtVerify, SignJWT } from "jose";

export const SESSION_TTL_SECONDS = 14 * 24 * 60 * 60;
const ISSUER = "catafy-api";

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signSession(user: SessionUser, secret: string): Promise<string> {
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(key(secret));
}

/** Returns the session user, or null for a missing/invalid/expired token. */
export async function verifySession(
  token: string | undefined,
  secret: string,
): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      issuer: ISSUER,
      algorithms: ["HS256"],
    });
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

import { createHash, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";

export const ACCESS_TTL_SECONDS = 30 * 24 * 60 * 60;
const ISSUER = "catafy-api";
const AUDIENCE = "catalogue-access";

/** catalogueId → passcode version. A changed passcode changes the version and revokes access. */
export type AccessGrants = Record<string, string>;

/**
 * How a buyer proves they may open a restricted catalogue. Today that is a shared passcode; an
 * OTP or invite-link verifier can implement the same interface later.
 */
export interface AccessVerifier {
  verify(catalogue: { passcode: string | null }, credential: string): boolean;
}

export const passcodeVerifier: AccessVerifier = {
  verify({ passcode }, credential) {
    if (!passcode) return false;
    // Compare fixed-length digests so the check is timing-safe whatever the input length.
    const a = createHash("sha256").update(passcode.toLowerCase()).digest();
    const b = createHash("sha256").update(credential.trim().toLowerCase()).digest();
    return timingSafeEqual(a, b);
  },
};

export function passcodeVersion(passcode: string): string {
  return createHash("sha256").update(passcode.toLowerCase()).digest("base64url").slice(0, 12);
}

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signAccess(grants: AccessGrants, secret: string): Promise<string> {
  return new SignJWT({ grants })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(key(secret));
}

/** Missing, forged or expired cookies all mean "nothing unlocked". */
export async function verifyAccess(
  token: string | undefined,
  secret: string,
): Promise<AccessGrants> {
  if (!token) return {};
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
    });
    const grants = payload.grants;
    if (!grants || typeof grants !== "object" || Array.isArray(grants)) return {};
    return Object.fromEntries(
      Object.entries(grants).filter(
        (e): e is [string, string] => /^[a-f0-9]{24}$/.test(e[0]) && typeof e[1] === "string",
      ),
    );
  } catch {
    return {};
  }
}

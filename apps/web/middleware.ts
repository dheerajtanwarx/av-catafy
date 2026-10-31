import { SESSION_COOKIE } from "@catafy/types";
import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

async function hasValidSession(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, secret, { issuer: "catafy-api", algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

/**
 * The client address set by the hosting proxy (Vercel, or nginx/Caddy on a VPS). The last
 * X-Forwarded-For entry is the one our own proxy appended; earlier entries are client-supplied.
 */
function clientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return forwarded || req.headers.get("x-real-ip")?.trim() || null;
}

/**
 * The /api/v1 rewrite to Express doesn't pass the buyer's IP on, so add it here, vouched for by
 * the shared secret. The API keys its rate limits on it; it is never stored.
 */
function forwardClientIp(req: NextRequest): NextResponse {
  const headers = new Headers(req.headers);
  // Never pass on values a client tried to set itself.
  headers.delete("x-catafy-client-ip");
  headers.delete("x-catafy-proxy-secret");
  const ip = clientIp(req);
  const secret = process.env.REVALIDATE_SECRET;
  if (ip && secret) {
    headers.set("x-catafy-client-ip", ip);
    headers.set("x-catafy-proxy-secret", secret);
  }
  return NextResponse.next({ request: { headers } });
}

/** /admin: a UX gate only (the API re-checks the session on every admin request). */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/api/v1/")) return forwardClientIp(req);

  const isLogin = pathname === "/admin/login";
  const authed = await hasValidSession(req);

  if (isLogin && authed) return NextResponse.redirect(new URL("/admin", req.url));
  if (!isLogin && !authed) {
    const url = new URL("/admin/login", req.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/v1/:path*"],
  runtime: "nodejs",
};

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

/** UX gate only: the API re-checks the session on every admin request. */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
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

export const config = { matcher: ["/admin", "/admin/:path*"], runtime: "nodejs" };

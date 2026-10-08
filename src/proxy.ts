import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge route protection. The backend validates the real JWT on every API
 * request; these cookies provide a quick UI gate before a page renders.
 */
const PUBLIC_PATHS = ["/login", "/axes", "/setup", "/signup-supervisor", "/"];

const ROLE_PATHS: Record<string, string[]> = {
  admin: ["/admin"],
  supervisor: ["/supervisor"],
  student: ["/student"],
};

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = btoa(crypto.randomUUID());
  const contentSecurityPolicy = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "frame-src 'self' blob:",
    "connect-src 'self' https: http://localhost:8081",
    "media-src 'self' blob:",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);
  const nextResponse = () => {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", contentSecurityPolicy);
    return response;
  };

  if (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|gif|css|js|woff|woff2|ttf)$/)
  ) {
    return nextResponse();
  }

  const loggedIn = request.cookies.get("internflow_logged_in")?.value === "1";
  const roleCookie = request.cookies.get("internflow_role")?.value ?? "";
  if (!loggedIn) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.headers.set("Content-Security-Policy", contentSecurityPolicy);
    return response;
  }

  for (const [role, prefixes] of Object.entries(ROLE_PATHS)) {
    if (prefixes.some((prefix) => pathname.startsWith(prefix)) && roleCookie !== role) {
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.headers.set("Content-Security-Policy", contentSecurityPolicy);
      return response;
    }
  }

  return nextResponse();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

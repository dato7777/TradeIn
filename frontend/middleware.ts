import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PRIVATE =
  /^\/(?:datadmin|admin|login|summary|api)(?:\/|$)/;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PRIVATE.test(pathname)) return NextResponse.next();

  const isEn = pathname === "/en" || pathname.startsWith("/en/");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-public-locale", isEn ? "en" : "he");
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", "form-action 'self'");
  if (/^\/(?:en\/)?alerts\/(?:confirm|unsubscribe)\/?$/.test(pathname)) {
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Robots-Tag", "noindex");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

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
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { appConfig } from "@/src/config/app";
import { getOperatorSessionFromRequest } from "@/src/features/auth/session";

// Path prefixes that require a signed-in operator
const PROTECTED_PREFIXES = ["/dashboard", "/students", "/teachers", "/classes", "/courses", "/schedules", "/attendance", "/finance", "/orders"];

// Paths only for guests (e.g. login); signed-in users are redirected away
const AUTH_ONLY_PATHS = ["/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const user = await getOperatorSessionFromRequest(request);

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isAuthOnly = AUTH_ONLY_PATHS.some((path) => pathname.startsWith(path));

  // Unauthenticated access to protected routes → redirect to login
  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user on login page → redirect to default app area
  if (isAuthOnly && user) {
    return NextResponse.redirect(new URL(appConfig.defaultProtectedPath, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static assets)
     * - _next/image (image optimization)
     * - favicon.ico
     * - api/ (Route Handlers, if any)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};

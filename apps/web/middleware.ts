import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { appConfig } from "@/src/config/app";
import { getOperatorSessionFromRequest } from "@/src/features/auth/session";

// 需要登录才能访问的路径前缀
const PROTECTED_PREFIXES = ["/dashboard", "/students", "/teachers", "/classes", "/courses", "/schedules", "/attendance", "/finance", "/orders"];

// 已登录用户不应访问的路径（如登录页）
const AUTH_ONLY_PATHS = ["/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const user = await getOperatorSessionFromRequest(request);

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isAuthOnly = AUTH_ONLY_PATHS.some((path) => pathname.startsWith(path));

  // 未登录访问受保护页面 → 重定向到登录
  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 已登录访问登录页 → 重定向到仪表板
  if (isAuthOnly && user) {
    return NextResponse.redirect(new URL(appConfig.defaultProtectedPath, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 匹配所有请求路径，排除:
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico
     * - api 路由（如有）
     */
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};

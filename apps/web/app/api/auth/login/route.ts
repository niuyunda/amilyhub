import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/src/features/auth/config";
import {
  authenticateOperator,
  createOperatorSessionValue,
  getSessionCookieOptions,
} from "@/src/features/auth/session";
import { appConfig } from "@/src/config/app";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { username?: string; password?: string; redirectTo?: string }
    | null;
  const username = body?.username?.trim() ?? "";
  const password = body?.password ?? "";
  const redirectTo = body?.redirectTo?.trim() || appConfig.defaultProtectedPath;

  if (!username || !password) {
    return NextResponse.json({ ok: false, error: "请输入账号和密码" }, { status: 400 });
  }

  const user = await authenticateOperator(username, password);
  if (!user) {
    return NextResponse.json({ ok: false, error: "账号或密码错误，请重试" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, redirectTo });
  response.cookies.set(AUTH_COOKIE_NAME, await createOperatorSessionValue(user), getSessionCookieOptions());
  return response;
}

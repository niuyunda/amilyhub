/**
 * 认证工具函数
 * 超级管理员凭据: amily / 128128
 */

export const VALID_CREDENTIALS = [
  { username: "amily", password: "128128", role: "super_admin", displayName: "超级管理员" },
] as const;

export const AUTH_COOKIE_NAME = "amilyhub_auth";

export type UserRole = "super_admin";

export interface AuthUser {
  username: string;
  displayName: string;
  role: UserRole;
}

/**
 * 验证用户凭据
 * @returns AuthUser if valid, null if invalid
 */
export function validateCredentials(username: string, password: string): AuthUser | null {
  const match = VALID_CREDENTIALS.find(
    (cred) => cred.username === username && cred.password === password,
  );
  if (!match) return null;
  return {
    username: match.username,
    displayName: match.displayName,
    role: match.role,
  };
}

/**
 * 从 cookie 字符串中读取认证信息
 * 供 middleware 使用（服务端/Edge Runtime）
 */
export function getAuthFromCookieString(cookieHeader: string | null): AuthUser | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const authCookie = cookies.find((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`));
  if (!authCookie) return null;
  try {
    const value = authCookie.slice(AUTH_COOKIE_NAME.length + 1);
    return JSON.parse(decodeURIComponent(value)) as AuthUser;
  } catch {
    return null;
  }
}

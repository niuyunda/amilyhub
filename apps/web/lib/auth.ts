export { AUTH_COOKIE_NAME } from "@/src/features/auth/config";
export { authenticateOperator as validateCredentials, readOperatorSession as getAuthFromCookieString } from "@/src/features/auth/session";
export type { OperatorRole as UserRole, OperatorUser as AuthUser } from "@/src/features/auth/types";

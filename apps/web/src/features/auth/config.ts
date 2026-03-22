import type { OperatorRole, OperatorUser } from "@/src/features/auth/types";

export const AUTH_COOKIE_NAME = "amilyhub_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type SeededCredential = {
  username: string;
  password: string;
  user: OperatorUser;
};

function getSeededCredentials(): SeededCredential[] {
  const username = process.env.AMILYHUB_OPERATOR_USERNAME ?? "amily";
  const password = process.env.AMILYHUB_OPERATOR_PASSWORD ?? "128128";
  const role = (process.env.AMILYHUB_OPERATOR_ROLE as OperatorRole | undefined) ?? "super_admin";
  const displayName = process.env.AMILYHUB_OPERATOR_DISPLAY_NAME ?? "超级管理员";
  const roleLabel = process.env.AMILYHUB_OPERATOR_ROLE_LABEL ?? "超级管理员";

  return [
    {
      username,
      password,
      user: {
        username,
        displayName,
        role,
        roleLabel,
      },
    },
  ];
}

export function getAuthSecret(): string {
  return process.env.AMILYHUB_AUTH_SECRET ?? "amilyhub-local-dev-secret";
}

export function authenticateSeededOperator(username: string, password: string): OperatorUser | null {
  const normalizedUsername = username.trim();
  const match = getSeededCredentials().find(
    (credential) => credential.username === normalizedUsername && credential.password === password,
  );
  return match?.user ?? null;
}

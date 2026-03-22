import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { appConfig } from "@/src/config/app";
import {
  AUTH_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  authenticateSeededOperator,
  getAuthSecret,
} from "@/src/features/auth/config";
import type { OperatorUser } from "@/src/features/auth/types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input: string): ArrayBuffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function getSigningKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getAuthSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signPayload(payload: string): Promise<string> {
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toBase64Url(signature);
}

async function verifySignature(payload: string, signature: string): Promise<boolean> {
  const key = await getSigningKey();
  return crypto.subtle.verify("HMAC", key, fromBase64Url(signature), encoder.encode(payload));
}

function isOperatorUser(value: unknown): value is OperatorUser {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<OperatorUser>;
  return (
    typeof candidate.username === "string" &&
    typeof candidate.displayName === "string" &&
    typeof candidate.role === "string" &&
    typeof candidate.roleLabel === "string"
  );
}

export async function createOperatorSessionValue(user: OperatorUser): Promise<string> {
  const payload = toBase64Url(encoder.encode(JSON.stringify(user)));
  const signature = await signPayload(payload);
  return `${payload}.${signature}`;
}

export async function readOperatorSession(value: string | undefined): Promise<OperatorUser | null> {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const valid = await verifySignature(payload, signature);
  if (!valid) return null;

  try {
    const parsed = JSON.parse(decoder.decode(new Uint8Array(fromBase64Url(payload)))) as unknown;
    return isOperatorUser(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function getOperatorSessionFromRequest(request: NextRequest): Promise<OperatorUser | null> {
  return readOperatorSession(request.cookies.get(AUTH_COOKIE_NAME)?.value);
}

export async function getCurrentOperatorSession(): Promise<OperatorUser | null> {
  const cookieStore = await cookies();
  return readOperatorSession(cookieStore.get(AUTH_COOKIE_NAME)?.value);
}

export async function requireOperatorSession(): Promise<OperatorUser> {
  const session = await getCurrentOperatorSession();
  if (!session) {
    redirect(`/login?from=${encodeURIComponent(appConfig.defaultProtectedPath)}`);
  }
  return session;
}

export async function authenticateOperator(username: string, password: string): Promise<OperatorUser | null> {
  return authenticateSeededOperator(username, password);
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

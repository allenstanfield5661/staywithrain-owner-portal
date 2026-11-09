import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Role } from "@/lib/catalog";
import { dataMode } from "@/lib/data-mode";
import { cookiesAreSecure } from "@/lib/preview-gate";

export const SESSION_COOKIE = "rs_owner_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

export function sessionSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production" && dataMode() === "live") {
    throw new Error("Set SESSION_SECRET.");
  }
  return "dev-only-preview-secret-not-for-production";
}

export function signSession(userId: string, now: number, role: Role = "owner"): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, role, exp: now + MAX_AGE_SECONDS * 1000 })).toString(
    "base64url",
  );
  const signature = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readSessionToken(token: string | undefined, now?: number): { uid: string; role?: Role } | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      uid?: unknown;
      role?: unknown;
      exp?: unknown;
    };
    if (typeof data.uid !== "string" || typeof data.exp !== "number") return null;
    if (now !== undefined && data.exp < now) return null;
    const role = data.role === "admin" || data.role === "owner" ? data.role : undefined;
    return { uid: data.uid, role };
  } catch {
    return null;
  }
}

export function passwordsMatch(input: string, expected: string): boolean {
  const left = createHash("sha256").update(input).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: cookiesAreSecure(),
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};

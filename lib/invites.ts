import { createHmac, timingSafeEqual } from "node:crypto";
import { sessionSecret } from "@/lib/session";

const INVITE_MS = 7 * 24 * 60 * 60 * 1000;

type InvitePayload = { email: string; purpose: "invite"; exp: number };

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createInviteToken(email: string, now = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ email: email.trim().toLowerCase(), purpose: "invite", exp: now + INVITE_MS } satisfies InvitePayload),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readInviteToken(token: string, now = Date.now()): { email: string } | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<InvitePayload>;
    if (data.purpose !== "invite" || typeof data.email !== "string" || typeof data.exp !== "number") return null;
    if (data.exp < now) return null;
    return { email: data.email };
  } catch {
    return null;
  }
}

export function inviteUrl(token: string): string {
  const origin = (process.env.URL || process.env.DEPLOY_PRIME_URL || "http://127.0.0.1:38471").replace(/\/$/, "");
  return `${origin}/invite?token=${encodeURIComponent(token)}`;
}

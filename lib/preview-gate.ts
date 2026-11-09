export const PREVIEW_COOKIE = "rs_preview_access";

export type PreviewDecision = "allow" | "gate" | "locked";

export function previewPassword(): string | undefined {
  const value = process.env.PREVIEW_PASSWORD?.trim();
  return value ? value : undefined;
}

function gateSecret(): string {
  return process.env.SESSION_SECRET || "dev-only-preview-secret-not-for-production";
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function previewToken(password: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(gateSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`rain-stanfield-preview:${password}`),
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function previewCookieMatches(token: string | undefined, password: string): Promise<boolean> {
  if (!token) return false;
  const expected = await previewToken(password);
  if (token.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < token.length; index += 1) {
    difference |= token.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

export function previewDecision(input: {
  nodeEnv: string | undefined;
  password: string | undefined;
  pathname: string;
  cookieOk: boolean;
  dataMode?: "mock" | "live";
}): PreviewDecision {
  if (input.dataMode === "live") return "allow";
  const openPath = input.pathname === "/preview-gate" || input.pathname === "/api/preview-gate";
  if (!input.password) {
    if (input.nodeEnv === "production") return openPath ? "allow" : "locked";
    return "allow";
  }
  if (openPath || input.cookieOk) return "allow";
  return "gate";
}

export function cookiesAreSecure(): boolean {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || "";
  return siteUrl.startsWith("https://") || process.env.VERCEL === "1";
}

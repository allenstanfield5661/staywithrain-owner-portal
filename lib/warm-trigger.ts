/** Fire-and-forget a cache warm. Never throw and never wait for Hostaway. */
export function triggerCalendarWarm(): void {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || "https://staywithrain.netlify.app";
  const secret = process.env.CRON_SECRET ?? "";
  const headers: Record<string, string> = { "cache-control": "no-store" };
  if (secret) headers.authorization = `Bearer ${secret}`;
  void fetch(`${base.replace(/\/$/, "")}/.netlify/functions/warm-calendar`, {
    method: "POST",
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(3000),
  }).catch(() => {
    // The scheduled warmer will fill the cache if this request cannot start.
  });
}

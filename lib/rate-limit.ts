const WINDOW_MS = 15 * 60 * 1000;
const LIMIT = 8;
const attempts = new Map<string, number[]>();

export function clearRateLimits(): void {
  attempts.clear();
}

/** Returns true when this attempt is allowed. */
export function allowAttempt(key: string, now = Date.now()): boolean {
  const recent = (attempts.get(key) ?? []).filter((stamp) => now - stamp < WINDOW_MS);
  if (recent.length >= LIMIT) {
    attempts.set(key, recent);
    return false;
  }
  recent.push(now);
  attempts.set(key, recent);
  return true;
}

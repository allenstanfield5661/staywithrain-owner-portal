import { BLOB_TIMEOUT_MS, withTimeout } from "@/lib/timeout";

const memory = new Map<string, { expires: number; value: unknown }>();

export const CACHE_TTL_MS = 10 * 60 * 1000;

export type CacheEntry<T> = { value: T; stale: boolean; expires: number };

export function clearTimedCache(): void {
  memory.clear();
}

export function setTimedCacheForTests<T>(key: string, value: T, expires: number): void {
  memory.set(key, { expires, value });
}

async function readBlob(key: string): Promise<string | null> {
  if (process.env.NETLIFY !== "true" && !process.env.NETLIFY_BLOBS_CONTEXT) return null;
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore("owner-portal");
    const value = await withTimeout(store.get(key, { type: "text" }), BLOB_TIMEOUT_MS, "Blob read timed out");
    return value ?? null;
  } catch {
    return null;
  }
}

async function writeBlob(key: string, value: string): Promise<void> {
  if (process.env.NETLIFY !== "true" && !process.env.NETLIFY_BLOBS_CONTEXT) return;
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore("owner-portal");
    await withTimeout(store.set(key, value), BLOB_TIMEOUT_MS, "Blob write timed out");
  } catch {
    // The in-memory copy still serves this instance.
  }
}

export async function peekEntry<T>(key: string): Promise<CacheEntry<T> | null> {
  const now = Date.now();
  const cached = memory.get(key);
  if (cached) {
    return { value: cached.value as T, stale: cached.expires <= now, expires: cached.expires };
  }
  const stored = await readBlob(key);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as { expires: number; value: T };
    if (parsed && parsed.value !== undefined && typeof parsed.expires === "number") {
      memory.set(key, parsed);
      return { value: parsed.value, stale: parsed.expires <= now, expires: parsed.expires };
    }
  } catch {
    // Ignore a corrupt cache entry.
  }
  return null;
}

export async function peek<T>(key: string): Promise<T | null> {
  const entry = await peekEntry<T>(key);
  return entry ? entry.value : null;
}

export async function writeTimedCache<T>(key: string, ttlMs: number, value: T): Promise<void> {
  const entry = { expires: Date.now() + ttlMs, value };
  memory.set(key, entry);
  await writeBlob(key, JSON.stringify(entry));
}

export async function remember<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  options?: { shouldPersist?: (value: T) => boolean; allowStale?: boolean },
): Promise<T> {
  const entry = await peekEntry<T>(key);
  if (entry && (options?.allowStale !== false ? true : !entry.stale)) return entry.value;
  const value = await load();
  if (options?.shouldPersist && !options.shouldPersist(value)) return value;
  await writeTimedCache(key, ttlMs, value);
  return value;
}

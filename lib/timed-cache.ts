const memory = new Map<string, { expires: number; value: unknown }>();

export const CACHE_TTL_MS = 10 * 60 * 1000;

export function clearTimedCache(): void {
  memory.clear();
}

async function readBlob(key: string): Promise<string | null> {
  if (process.env.NETLIFY !== "true" && !process.env.NETLIFY_BLOBS_CONTEXT) return null;
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore("owner-portal");
    return await store.get(key, { type: "text" });
  } catch {
    return null;
  }
}

async function writeBlob(key: string, value: string): Promise<void> {
  if (process.env.NETLIFY !== "true" && !process.env.NETLIFY_BLOBS_CONTEXT) return;
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore("owner-portal");
    await store.set(key, value);
  } catch {
    // The in-memory copy still serves this instance.
  }
}

export async function remember<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  options?: { shouldPersist?: (value: T) => boolean },
): Promise<T> {
  const now = Date.now();
  const cached = memory.get(key);
  if (cached && cached.expires > now) return cached.value as T;
  const stored = await readBlob(key);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as { expires: number; value: T };
      if (parsed.expires > now) {
        memory.set(key, parsed);
        return parsed.value;
      }
    } catch {
      // Ignore a corrupt cache entry and load again.
    }
  }
  const value = await load();
  if (options?.shouldPersist && !options.shouldPersist(value)) return value;
  const entry = { expires: now + ttlMs, value };
  memory.set(key, entry);
  await writeBlob(key, JSON.stringify(entry));
  return value;
}

import { BLOB_TIMEOUT_MS, withTimeout } from "@/lib/timeout";
import type { PushedCartEvent } from "@/lib/ics";

export const GOLF_CART_EVENTS_KEY = "golfcart:events";

function blobsEnabled(): boolean {
  return process.env.NETLIFY === "true" || Boolean(process.env.NETLIFY_BLOBS_CONTEXT);
}

function asEventList(value: unknown): PushedCartEvent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const summary = typeof item.summary === "string" ? item.summary : "";
    const start = typeof item.start === "string" ? item.start : "";
    const end = typeof item.end === "string" ? item.end : "";
    if (!summary || !start || !end) return [];
    const calendar = typeof item.calendar === "string" ? item.calendar : undefined;
    return [{ calendar, summary, start, end }];
  });
}

/** null = no push has been stored yet; array (maybe empty) = push replaced the STR set. */
export async function readPushedGolfCartEvents(): Promise<PushedCartEvent[] | null> {
  if (!blobsEnabled()) return null;
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore("owner-portal");
    const raw = await withTimeout(
      store.get(GOLF_CART_EVENTS_KEY, { type: "text" }),
      BLOB_TIMEOUT_MS,
      "Blob read timed out",
    );
    if (raw == null) return null;
    return asEventList(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Replace the whole STR Golf Cart Rentals pushed set. */
export async function writePushedGolfCartEvents(events: PushedCartEvent[]): Promise<void> {
  if (!blobsEnabled()) {
    throw new Error("Golf cart push storage is only available on Netlify.");
  }
  const { getStore } = await import("@netlify/blobs");
  const store = getStore("owner-portal");
  const payload = events.map((event) => ({
    calendar: event.calendar ?? "STR Golf Cart Rentals",
    summary: event.summary,
    start: event.start,
    end: event.end,
  }));
  await withTimeout(store.set(GOLF_CART_EVENTS_KEY, JSON.stringify(payload)), BLOB_TIMEOUT_MS, "Blob write timed out");
}

export function parsePushBody(body: unknown): PushedCartEvent[] {
  if (Array.isArray(body)) return asEventList(body);
  if (body && typeof body === "object" && Array.isArray((body as { events?: unknown }).events)) {
    return asEventList((body as { events: unknown[] }).events);
  }
  throw new Error("Body must be a JSON array of {calendar, summary, start, end}.");
}

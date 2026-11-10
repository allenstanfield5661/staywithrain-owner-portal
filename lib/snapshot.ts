import { dedupeCarts, golfCartFeedUrls } from "@/lib/cart-match";
import { expectedCalendarName, listTagMappings, type Unit } from "@/lib/catalog";
import { dataMode, type DataSource } from "@/lib/data-mode";
import { addDays, daysInMonth, GULF_TZ, isoDate, parseISODate, todayInTimeZone, windowMonths } from "@/lib/dates";
import { loadLiveCalendar } from "@/lib/hostaway";
import { parseIcs, parseIcsForUnits, type ParsedCart } from "@/lib/ics";
import { buildMockIcs, buildMockStays } from "@/lib/mock-source";
import type { PublicStay } from "@/lib/stays";
import { CACHE_TTL_MS, peekEntry, writeTimedCache } from "@/lib/timed-cache";

export type { DataSource };
export { dataMode };
export type CartSource = "mock" | "ics" | "unconfigured";

export type Snapshot = {
  fetchedAt: string;
  source: DataSource;
  cartSource: CartSource;
  warning?: string;
  matchedUnitIds: string[] | null;
  units?: Unit[];
  stays: PublicStay[];
  carts: ParsedCart[];
  unmatchedCarts: number;
};

function windowBounds(today: string): { start: string; end: string } {
  const months = windowMonths(today);
  const last = parseISODate(`${months[months.length - 1]}-01`);
  return {
    start: `${months[0]}-01`,
    end: addDays(isoDate(last.y, last.m, daysInMonth(last.y, last.m)), 1),
  };
}

function overlaps(start: string, end: string, windowStart: string, windowEnd: string): boolean {
  return start < windowEnd && end > windowStart;
}

export function snapshotCacheKey(now: Date): string {
  const bounds = windowBounds(todayInTimeZone(GULF_TZ, now));
  return `snapshot:${bounds.start}:${bounds.end}`;
}

function buildMockSnapshot(now: Date): Snapshot {
  const fetchedAt = now.toISOString();
  const bounds = windowBounds(todayInTimeZone(GULF_TZ, now));
  const parsed = parseIcs(buildMockIcs(), listTagMappings());
  return {
    fetchedAt,
    source: "mock",
    cartSource: "mock",
    matchedUnitIds: null,
    stays: buildMockStays().filter((stay) => overlaps(stay.arrival, stay.departure, bounds.start, bounds.end)),
    carts: parsed.events.filter((event) => overlaps(event.start, event.end, bounds.start, bounds.end)),
    unmatchedCarts: parsed.unmatched,
  };
}

export async function buildSnapshot(now: Date): Promise<Snapshot> {
  if (dataMode() === "mock") return buildMockSnapshot(now);
  const bounds = windowBounds(todayInTimeZone(GULF_TZ, now));
  const { stays, units, warning } = await loadLiveCalendar(bounds.start, bounds.end);
  const carts = await liveCarts(units, bounds.start, bounds.end);
  return {
    fetchedAt: now.toISOString(),
    source: "live",
    cartSource: carts.cartSource,
    warning: [warning, carts.warning].filter(Boolean).join(" ") || undefined,
    matchedUnitIds: units.map((unit) => unit.id),
    units,
    stays,
    carts: carts.events,
    unmatchedCarts: carts.unmatched,
  };
}

export type CachedSnapshot = { snapshot: Snapshot; stale: boolean };

export async function readCachedSnapshot(now: Date = new Date()): Promise<CachedSnapshot | null> {
  if (dataMode() === "mock") return { snapshot: buildMockSnapshot(now), stale: false };
  const entry = await peekEntry<Snapshot>(snapshotCacheKey(now));
  if (!entry) return null;
  return { snapshot: entry.value, stale: entry.stale };
}

export async function warmSnapshot(now: Date = new Date(), options?: { force?: boolean }): Promise<Snapshot> {
  if (dataMode() === "mock") return buildMockSnapshot(now);
  if (!options?.force) {
    const entry = await peekEntry<Snapshot>(snapshotCacheKey(now));
    if (entry && !entry.stale) return entry.value;
  }
  const snapshot = await buildSnapshot(now);
  if (!snapshot.warning) await writeTimedCache(snapshotCacheKey(now), CACHE_TTL_MS, snapshot);
  return snapshot;
}

export async function loadSnapshot(now?: Date): Promise<Snapshot> {
  const { io } = await import("next/cache");
  await io();
  const clock = now ?? new Date();
  const cached = await readCachedSnapshot(clock);
  if (cached) return cached.snapshot;
  return warmSnapshot(clock);
}

function keepKnownUnits(events: ParsedCart[], units: Unit[]): ParsedCart[] {
  const ids = new Set(units.map((unit) => unit.id));
  return events.filter((event) => ids.has(event.unitId));
}

async function readCartFeed(url: string): Promise<{ text: string } | { failed: true }> {
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20000) });
    if (!response.ok) return { failed: true };
    return { text: await response.text() };
  } catch {
    return { failed: true };
  }
}

async function liveCarts(units: Unit[], windowStart: string, windowEnd: string): Promise<{
  events: ParsedCart[];
  unmatched: number;
  cartSource: CartSource;
  warning?: string;
}> {
  const urls = golfCartFeedUrls();
  if (urls.length === 0) {
    return { events: [], unmatched: 0, cartSource: "unconfigured" };
  }
  const results = await Promise.all(urls.map((url) => readCartFeed(url)));
  const texts = results.flatMap((result) => ("text" in result ? [result.text] : []));
  const failed = results.length - texts.length;
  if (texts.length === 0) {
    return {
      events: [],
      unmatched: 0,
      cartSource: "unconfigured",
      warning: failed > 1 ? "The golf cart calendars could not be read." : "The golf cart calendar could not be read.",
    };
  }
  const parsed = texts.map((text) => parseIcsForUnits(text, units));
  const events = dedupeCarts(parsed.flatMap((item) => keepKnownUnits(item.events, units))).filter((event) =>
    overlaps(event.start, event.end, windowStart, windowEnd),
  );
  const unmatched = parsed.reduce((sum, item) => sum + item.unmatched, 0);
  const names = parsed.map((item) => item.calendarName).filter((name): name is string => Boolean(name));
  const unexpected = names.filter((name) => !name.toLowerCase().includes("golf cart"));
  const warningParts: string[] = [];
  if (failed > 0) {
    warningParts.push(
      failed === 1 ? "One golf cart calendar could not be read." : "Some golf cart calendars could not be read.",
    );
  }
  if (unexpected.length > 0) {
    warningParts.push(
      unexpected.length === 1
        ? `This feed is named “${unexpected[0]}”, not “${expectedCalendarName()}”. Matching events were still read.`
        : "A golf cart feed had an unexpected calendar name. Matching events were still read.",
    );
  }
  return {
    events,
    unmatched,
    cartSource: "ics",
    warning: warningParts.join(" ") || undefined,
  };
}

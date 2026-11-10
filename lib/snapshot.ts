import { expectedCalendarName, listTagMappings, listUnits, normalizeName, type Unit } from "@/lib/catalog";
import { dataMode, type DataSource } from "@/lib/data-mode";
import { addDays, daysInMonth, GULF_TZ, isoDate, parseISODate, todayInTimeZone, windowMonths } from "@/lib/dates";
import { loadLiveCalendar } from "@/lib/hostaway";
import { parseIcs, type ParsedCart } from "@/lib/ics";
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

function retargetCarts(events: ParsedCart[], units: Unit[]): ParsedCart[] {
  return events.flatMap((event) => {
    const catalog = listUnits().find((unit) => unit.id === event.unitId);
    if (!catalog) return [];
    const listing = units.find(
      (unit) =>
        (catalog.hostawayListingId != null && String(catalog.hostawayListingId) === unit.id) ||
        normalizeName(unit.name) === normalizeName(catalog.name),
    );
    if (!listing) return [];
    return [{ ...event, unitId: listing.id }];
  });
}

async function liveCarts(units: Unit[], windowStart: string, windowEnd: string): Promise<{
  events: ParsedCart[];
  unmatched: number;
  cartSource: CartSource;
  warning?: string;
}> {
  const icsUrl = process.env.GOLF_CART_ICS_URL?.trim();
  if (!icsUrl) {
    return { events: [], unmatched: 0, cartSource: "unconfigured" };
  }
  try {
    const response = await fetch(icsUrl, { cache: "no-store", signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`The golf cart calendar responded with ${response.status}.`);
    const parsed = parseIcs(await response.text(), listTagMappings());
    const warning =
      parsed.calendarName && !parsed.calendarName.toLowerCase().includes("golf cart")
        ? `This feed is named “${parsed.calendarName}”, not “${expectedCalendarName()}”. Tagged events were still read.`
        : undefined;
    return {
      events: retargetCarts(parsed.events, units).filter((event) => overlaps(event.start, event.end, windowStart, windowEnd)),
      unmatched: parsed.unmatched,
      cartSource: "ics",
      warning,
    };
  } catch (error) {
    return {
      events: [],
      unmatched: 0,
      cartSource: "unconfigured",
      warning: error instanceof Error ? error.message : "The golf cart calendar could not be read.",
    };
  }
}

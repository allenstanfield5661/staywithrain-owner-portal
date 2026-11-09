import { io } from "next/cache";
import { expectedCalendarName, listTagMappings, listUnits, normalizeName, type Unit } from "@/lib/catalog";
import { dataMode, type DataSource } from "@/lib/data-mode";
import { addDays, daysInMonth, GULF_TZ, isoDate, parseISODate, todayInTimeZone, windowMonths } from "@/lib/dates";
import { loadLiveCalendar } from "@/lib/hostaway";
import { parseIcs, type ParsedCart } from "@/lib/ics";
import { buildMockIcs, buildMockStays } from "@/lib/mock-source";
import type { PublicStay } from "@/lib/stays";

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

export async function loadSnapshot(now?: Date): Promise<Snapshot> {
  await io();
  const clock = now ?? new Date();
  const fetchedAt = clock.toISOString();
  const today = todayInTimeZone(GULF_TZ, clock);
  const bounds = windowBounds(today);
  const mode = dataMode();

  if (mode === "mock") {
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

  const { stays, units } = await loadLiveCalendar(bounds.start, bounds.end);
  const matchedUnitIds = units.map((unit) => unit.id);
  const carts = await liveCarts(units, bounds.start, bounds.end);
  return {
    fetchedAt,
    source: "live",
    cartSource: carts.cartSource,
    warning: carts.warning,
    matchedUnitIds,
    units,
    stays,
    carts: carts.events,
    unmatchedCarts: carts.unmatched,
  };
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

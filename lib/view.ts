import { cartTagsForUnit } from "@/lib/cart-match";
import { tagsForListing, type PublicAccount, type Unit } from "@/lib/catalog";
import { bookingUrlFor, welcomeGuideUrlFor } from "@/lib/listing-links";
import {
  addDays,
  daysInMonth,
  formatMonth,
  GULF_TZ,
  isoDate,
  monthGrid,
  parseISODate,
  reportingMonths,
  todayInTimeZone,
  windowMonths,
} from "@/lib/dates";
import type { ParsedCart } from "@/lib/ics";
import { occupancyForMonth, type Occupancy } from "@/lib/occupancy";
import type { Snapshot } from "@/lib/snapshot";
import type { PublicStay } from "@/lib/stays";

export type UnitView = {
  id: string;
  name: string;
  town: string;
  bedrooms: number;
  tags: string[];
  hasGolfCart: boolean;
  hostawayLinked: boolean | null;
  bookingUrl: string | null;
  welcomeGuideUrl: string | null;
};

export type PortalView = {
  account: PublicAccount;
  fetchedAt: string;
  source: Snapshot["source"];
  cartSource: Snapshot["cartSource"];
  warning?: string;
  today: string;
  months: string[];
  month: string;
  units: UnitView[];
  selected: UnitView | null;
  occupancy: Array<Occupancy & { label: string; when: "This month" | "Next month" }>;
  upcoming: PublicStay[];
  calendarStays: PublicStay[];
  calendarCarts: ParsedCart[];
  inHouse: PublicStay | null;
  unmatchedCarts: number;
};

export function portalHref(unitId: string, month: string): string {
  return `/portal?unit=${encodeURIComponent(unitId)}&month=${encodeURIComponent(month)}`;
}

export function unitsVisibleTo(account: PublicAccount, units: Unit[], assignments: Record<string, string | null>): Unit[] {
  if (account.role === "admin") return units;
  return units.filter((unit) => assignments[unit.id] === account.id);
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function overlaps(start: string, end: string, windowStart: string, windowEnd: string): boolean {
  return start < windowEnd && end > windowStart;
}

function toUnitView(unit: Unit, snapshot: Snapshot): UnitView {
  const tags = [...new Set([...tagsForListing(unit), ...cartTagsForUnit(unit)])];
  return {
    id: unit.id,
    name: unit.name,
    town: unit.town,
    bedrooms: unit.bedrooms,
    tags,
    hasGolfCart: tags.length > 0 || snapshot.carts.some((cart) => cart.unitId === unit.id),
    hostawayLinked: snapshot.source === "live" ? (snapshot.matchedUnitIds?.includes(unit.id) ?? false) : null,
    bookingUrl: bookingUrlFor(unit),
    welcomeGuideUrl: welcomeGuideUrlFor(unit),
  };
}

export function buildPortalView(input: {
  account: PublicAccount;
  units: Unit[];
  assignments: Record<string, string | null>;
  snapshot: Snapshot;
  unit?: string | string[];
  month?: string | string[];
  now?: Date;
}): PortalView {
  const now = input.now;
  if (!now) throw new Error("A request time is required to build the portal.");
  const today = todayInTimeZone(GULF_TZ, now);
  const months = windowMonths(today);
  const visible = unitsVisibleTo(input.account, input.units, input.assignments).map((unit) =>
    toUnitView(unit, input.snapshot),
  );
  const requestedUnit = firstParam(input.unit);
  const selected = visible.find((unit) => unit.id === requestedUnit) ?? visible[0] ?? null;
  const requestedMonth = firstParam(input.month);
  const month = requestedMonth && months.includes(requestedMonth) ? requestedMonth : reportingMonths(today, months)[0];
  const ownedIds = new Set(visible.map((unit) => unit.id));
  const stays = input.snapshot.stays.filter((stay) => ownedIds.has(stay.unitId));
  const carts = input.snapshot.carts.filter((cart) => ownedIds.has(cart.unitId));
  const selectedStays = selected ? stays.filter((stay) => stay.unitId === selected.id) : [];
  const selectedCarts = selected ? carts.filter((cart) => cart.unitId === selected.id) : [];
  const [thisMonth, nextMonth] = reportingMonths(today, months);
  const occupancy = [thisMonth, nextMonth].map((key, index) => ({
    ...occupancyForMonth(
      key,
      selectedStays.map((stay) => ({
        arrival: stay.arrival,
        departure: stay.departure,
        kind: stay.tone === "owner" ? ("owner" as const) : ("guest" as const),
      })),
    ),
    label: formatMonth(key),
    when: index === 0 ? ("This month" as const) : ("Next month" as const),
  }));
  const lastMonth = parseISODate(`${months[months.length - 1]}-01`);
  const windowEndIso = addDays(isoDate(lastMonth.y, lastMonth.m, daysInMonth(lastMonth.y, lastMonth.m)), 1);
  const upcoming = selectedStays
    .filter((stay) => stay.departure > today && stay.arrival < windowEndIso)
    .sort((a, b) => a.arrival.localeCompare(b.arrival) || a.guest.localeCompare(b.guest));
  const weeks = monthGrid(month);
  const gridStart = weeks[0][0].iso;
  const gridEnd = addDays(weeks[weeks.length - 1][6].iso, 1);
  const inHouse =
    selectedStays
      .filter((stay) => stay.arrival <= today && today < stay.departure)
      .sort((a, b) => b.arrival.localeCompare(a.arrival))[0] ?? null;

  return {
    account: input.account,
    fetchedAt: input.snapshot.fetchedAt,
    source: input.snapshot.source,
    cartSource: input.snapshot.cartSource,
    warning: input.snapshot.warning,
    today,
    months,
    month,
    units: visible,
    selected,
    occupancy,
    upcoming,
    calendarStays: selectedStays.filter((stay) => overlaps(stay.arrival, stay.departure, gridStart, gridEnd)),
    calendarCarts: selectedCarts.filter((cart) => overlaps(cart.start, cart.end, gridStart, gridEnd)),
    inHouse,
    unmatchedCarts: input.account.role === "admin" ? input.snapshot.unmatchedCarts : 0,
  };
}

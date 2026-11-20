import {
  addDays,
  addMonths,
  daysInMonth,
  formatMonth,
  GULF_TZ,
  isoDate,
  monthGrid,
  monthKey,
  parseISODate,
  reportingMonths,
  todayInTimeZone,
  windowMonths,
} from "@/lib/dates";
import { occupancyForMonth, type Occupancy } from "@/lib/occupancy";

/**
 * Fictional sample for the public /demo route.
 * Keep this file on its own. It does not read live calendars, blob storage, owner records, or auth cookies.
 */

export const DEMO_OWNER_NAME = "Sample Owner";
export const DEMO_OWNER_LABEL = "Gulf Coast Preview";
export const DEMO_BOOKING_SITE = "https://staywithrain.thebookingportal.com/";
export const DEMO_VIEWS = ["overview", "calendar", "reservations", "statements", "golf-cart"] as const;
export type DemoView = (typeof DEMO_VIEWS)[number];
export type DemoChannel = "Airbnb" | "Direct" | "Vrbo";
export type DemoScope = "both" | string;

type Kind = "guest" | "owner" | "pending" | "updated";

type Anchor = {
  dayOffset: number;
  nights: number;
  guest: readonly [string, string] | null;
  channel: DemoChannel;
  kind: Kind;
};

export type DemoProperty = {
  id: string;
  name: string;
  town: string;
  bedrooms: number;
  hasGolfCart: boolean;
  blurb: string;
  cleaningFee: number;
  nightlyRates: number[];
};

export type DemoStay = {
  id: string;
  unitId: string;
  guest: string;
  arrival: string;
  departure: string;
  nights: number;
  channel: DemoChannel | "Owner";
  tone: "guest" | "owner" | "pending";
  statusLabel: string;
  nightlyRate: number;
  cleaningFee: number;
  lodging: number;
  channelFee: number;
  ownerPayout: number;
};

export type DemoCart = {
  id: string;
  unitId: string;
  label: string;
  start: string;
  end: string;
};

export type DemoStatement = {
  month: string;
  label: string;
  stays: number;
  guestNights: number;
  lodging: number;
  cleaning: number;
  channelFees: number;
  ownerPayout: number;
  lines: DemoStay[];
};

export type DemoModel = {
  ownerName: string;
  ownerLabel: string;
  fetchedAt: string;
  today: string;
  view: DemoView;
  scope: DemoScope;
  properties: DemoProperty[];
  selected: DemoProperty;
  month: string;
  months: string[];
  channel: DemoChannel | "all";
  occupancy: Array<Occupancy & { label: string; when: "This month" | "Next month" }>;
  payoutSummary: {
    thisMonth: number;
    nextMonth: number;
    onTheBooks: number;
    thisLabel: string;
    nextLabel: string;
  };
  inHouse: DemoStay | null;
  calendarStays: DemoStay[];
  calendarCarts: DemoCart[];
  upcoming: DemoStay[];
  recent: DemoStay[];
  reservationUpcoming: DemoStay[];
  reservationRecent: DemoStay[];
  selectedStay: DemoStay | null;
  statements: DemoStatement[];
  openStatement: DemoStatement | null;
  showGolfCart: boolean;
};

export const DEMO_PROPERTIES: DemoProperty[] = [
  {
    id: "porch-light-cottage",
    name: "Porch Light Cottage",
    town: "Ocean Springs",
    bedrooms: 3,
    hasGolfCart: true,
    blurb: "Fictional 3-bedroom cottage near downtown.",
    cleaningFee: 165,
    nightlyRates: [268, 285, 259, 292, 274],
  },
  {
    id: "bayou-breeze-suite",
    name: "Bayou Breeze Suite",
    town: "Ocean Springs",
    bedrooms: 2,
    hasGolfCart: false,
    blurb: "Fictional 2-bedroom coastal condo near Porter Ave.",
    cleaningFee: 125,
    nightlyRates: [189, 176, 198, 184, 205],
  },
];

const COTTAGE_ANCHORS: Anchor[] = [
  { dayOffset: -10, nights: 4, guest: ["Sarah", "K"], channel: "Airbnb", kind: "guest" },
  { dayOffset: -2, nights: 5, guest: ["Jordan", "M"], channel: "Direct", kind: "guest" },
  { dayOffset: 6, nights: 4, guest: ["Miles", "A"], channel: "Vrbo", kind: "guest" },
  { dayOffset: 13, nights: 3, guest: ["Avery", "L"], channel: "Airbnb", kind: "updated" },
  { dayOffset: 18, nights: 4, guest: null, channel: "Direct", kind: "owner" },
  { dayOffset: 25, nights: 3, guest: ["Noah", "P"], channel: "Airbnb", kind: "pending" },
];

const SUITE_ANCHORS: Anchor[] = [
  { dayOffset: -8, nights: 3, guest: ["Quinn", "R"], channel: "Vrbo", kind: "guest" },
  { dayOffset: -1, nights: 4, guest: ["Riley", "S"], channel: "Airbnb", kind: "guest" },
  { dayOffset: 5, nights: 5, guest: ["Casey", "D"], channel: "Direct", kind: "guest" },
  { dayOffset: 13, nights: 4, guest: ["Rowan", "H"], channel: "Vrbo", kind: "guest" },
  { dayOffset: 20, nights: 5, guest: null, channel: "Direct", kind: "owner" },
  { dayOffset: 28, nights: 2, guest: ["Parker", "G"], channel: "Airbnb", kind: "pending" },
];

const FILLER_GUESTS = [
  ["Skye", "N"],
  ["Drew", "C"],
  ["Harper", "B"],
  ["Logan", "T"],
  ["Reese", "W"],
  ["Eden", "F"],
  ["Micah", "J"],
  ["Sloane", "P"],
] as const;

const FILLER_CHANNELS: DemoChannel[] = ["Airbnb", "Vrbo", "Direct"];
const FILLER_NIGHTS = [4, 5, 3, 4, 5];
const FILLER_GAPS = [2, 1, 2, 3, 2];

const CHANNEL_FEE: Record<DemoChannel, number> = {
  Airbnb: 0.155,
  Vrbo: 0.08,
  Direct: 0,
};

export function isDemoView(value: string | undefined): value is DemoView {
  return Boolean(value && (DEMO_VIEWS as readonly string[]).includes(value));
}

export function firstQuery(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function formatDemoMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function demoHref(input: {
  view?: DemoView;
  unit?: string;
  month?: string;
  channel?: DemoChannel | "all";
  stay?: string;
  scope?: string;
  statement?: string;
}): string {
  const view = input.view ?? "overview";
  const path = view === "overview" ? "/demo" : `/demo/${view}`;
  const params = new URLSearchParams();
  if (input.unit) params.set("unit", input.unit);
  if (input.month) params.set("month", input.month);
  if (input.scope && input.scope !== "both") params.set("scope", input.scope);
  if (input.channel && input.channel !== "all") params.set("channel", input.channel);
  if (input.stay) params.set("stay", input.stay);
  if (input.statement) params.set("statement", input.statement);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function presentKind(kind: Kind): Pick<DemoStay, "tone" | "statusLabel"> {
  if (kind === "owner") return { tone: "owner", statusLabel: "Owner stay" };
  if (kind === "pending") return { tone: "pending", statusLabel: "Pending" };
  if (kind === "updated") return { tone: "guest", statusLabel: "Updated" };
  return { tone: "guest", statusLabel: "Confirmed" };
}

function priceStay(property: DemoProperty, nights: number, channel: DemoChannel, kind: Kind, rateIndex: number) {
  if (kind === "owner") {
    return { nightlyRate: 0, cleaningFee: 0, lodging: 0, channelFee: 0, ownerPayout: 0 };
  }
  const nightlyRate = property.nightlyRates[rateIndex % property.nightlyRates.length];
  const lodging = nightlyRate * nights;
  const channelFee = Math.round(lodging * CHANNEL_FEE[channel]);
  return {
    nightlyRate,
    cleaningFee: property.cleaningFee,
    lodging,
    channelFee,
    ownerPayout: lodging - channelFee,
  };
}

function staysOverlap(a: { arrival: string; departure: string }, b: { arrival: string; departure: string }): boolean {
  return a.arrival < b.departure && b.arrival < a.departure;
}

function windowEndIso(today: string): string {
  const months = windowMonths(today);
  const last = parseISODate(`${months[months.length - 1]}-01`);
  return addDays(isoDate(last.y, last.m, daysInMonth(last.y, last.m)), 1);
}

function previousMonth(today: string): string {
  const parsed = parseISODate(today);
  const prev = addMonths(parsed.y, parsed.m, -1);
  return monthKey(prev.y, prev.m);
}

function anchorsFor(propertyId: string): Anchor[] {
  return propertyId === "bayou-breeze-suite" ? SUITE_ANCHORS : COTTAGE_ANCHORS;
}

function buildStays(property: DemoProperty, today: string): DemoStay[] {
  const anchors = anchorsFor(property.id);
  let rateIndex = 0;
  const stays: DemoStay[] = anchors.map((anchor) => {
    const stay = {
      ...makeStay(property, addDays(today, anchor.dayOffset), anchor, rateIndex),
    };
    if (anchor.kind !== "owner") rateIndex += 1;
    return stay;
  });

  const end = windowEndIso(today);
  let cursor = addDays(stays[stays.length - 1].departure, 2);
  let index = 0;
  while (cursor < end && stays.length < 16) {
    const nights = FILLER_NIGHTS[(index + property.bedrooms) % FILLER_NIGHTS.length];
    const departure = addDays(cursor, nights);
    const candidate = { arrival: cursor, departure };
    if (stays.some((stay) => staysOverlap(stay, candidate))) {
      cursor = addDays(cursor, 1);
      continue;
    }
    const kind: Kind = index % 6 === 5 ? "owner" : index % 5 === 4 ? "pending" : index % 4 === 2 ? "updated" : "guest";
    const guest = FILLER_GUESTS[(index + property.bedrooms) % FILLER_GUESTS.length];
    const channel = FILLER_CHANNELS[(index + property.bedrooms) % FILLER_CHANNELS.length];
    stays.push(makeStay(property, cursor, { dayOffset: 0, nights, guest, channel, kind }, rateIndex));
    if (kind !== "owner") rateIndex += 1;
    cursor = addDays(departure, FILLER_GAPS[index % FILLER_GAPS.length]);
    index += 1;
  }

  stays.sort((a, b) => a.arrival.localeCompare(b.arrival) || a.guest.localeCompare(b.guest));
  for (let i = 1; i < stays.length; i += 1) {
    if (staysOverlap(stays[i - 1], stays[i])) {
      throw new Error(`Sample stays overlap on ${property.name}.`);
    }
  }
  return stays;
}

function makeStay(property: DemoProperty, arrival: string, anchor: Anchor, rateIndex: number): DemoStay {
  const presentation = presentKind(anchor.kind);
  const priced = priceStay(property, anchor.nights, anchor.channel, anchor.kind, rateIndex);
  return {
    id: `${property.id}-${arrival}`,
    unitId: property.id,
    guest: presentation.tone === "owner" || !anchor.guest ? "Owner" : `${anchor.guest[0]} ${anchor.guest[1]}.`,
    arrival,
    departure: addDays(arrival, anchor.nights),
    nights: anchor.nights,
    channel: presentation.tone === "owner" ? "Owner" : anchor.channel,
    tone: presentation.tone,
    statusLabel: presentation.statusLabel,
    ...priced,
  };
}

function buildCarts(property: DemoProperty, stays: DemoStay[], today: string): DemoCart[] {
  if (!property.hasGolfCart) return [];
  return stays
    .filter((stay, index) => {
      if (stay.tone === "pending") return false;
      const inHouse = stay.arrival <= today && today < stay.departure;
      return inHouse || stay.tone === "owner" || index % 2 === 0;
    })
    .map((stay) => ({
      id: `cart-${stay.id}`,
      unitId: property.id,
      label: stay.guest,
      start: stay.arrival,
      end: stay.departure,
    }));
}

function gridBounds(month: string): { start: string; end: string } {
  const weeks = monthGrid(month);
  return {
    start: weeks[0][0].iso,
    end: addDays(weeks[weeks.length - 1][6].iso, 1),
  };
}

function overlapsRange(start: string, end: string, windowStart: string, windowEnd: string): boolean {
  return start < windowEnd && end > windowStart;
}

function matchesChannel(stay: DemoStay, channel: DemoChannel | "all"): boolean {
  if (channel === "all") return true;
  return stay.channel === channel;
}

function payable(stay: DemoStay): boolean {
  return stay.tone === "guest";
}

function buildStatements(stays: DemoStay[], today: string): DemoStatement[] {
  const months = windowMonths(today);
  const [thisMonth, nextMonth] = reportingMonths(today, months);
  const candidates = [previousMonth(today), ...months];
  return candidates
    .filter((month, index) => candidates.indexOf(month) === index)
    .filter((month) => month === thisMonth || month === nextMonth || stays.some((stay) => stay.departure.startsWith(month)))
    .map((month) => {
      const lines = stays
        .filter((stay) => stay.departure.startsWith(month))
        .sort((a, b) => a.departure.localeCompare(b.departure) || a.guest.localeCompare(b.guest));
      const counted = lines.filter(payable);
      return {
        month,
        label: formatMonth(month),
        stays: counted.length,
        guestNights: counted.reduce((sum, stay) => sum + stay.nights, 0),
        lodging: counted.reduce((sum, stay) => sum + stay.lodging, 0),
        cleaning: counted.reduce((sum, stay) => sum + stay.cleaningFee, 0),
        channelFees: counted.reduce((sum, stay) => sum + stay.channelFee, 0),
        ownerPayout: counted.reduce((sum, stay) => sum + stay.ownerPayout, 0),
        lines,
      };
    });
}

export function buildDemoModel(input: {
  now: Date;
  view?: string;
  unit?: string;
  month?: string;
  channel?: string;
  stay?: string;
  scope?: string;
  statement?: string;
}): DemoModel {
  const today = todayInTimeZone(GULF_TZ, input.now);
  const months = windowMonths(today);
  const [thisMonth, nextMonth] = reportingMonths(today, months);
  const scope: DemoScope =
    input.scope && DEMO_PROPERTIES.some((property) => property.id === input.scope) ? input.scope : "both";
  const properties = scope === "both" ? DEMO_PROPERTIES : DEMO_PROPERTIES.filter((property) => property.id === scope);
  const selected = properties.find((property) => property.id === input.unit) ?? properties[0];
  const month = input.month && months.includes(input.month) ? input.month : thisMonth;
  const channel: DemoChannel | "all" =
    input.channel === "Airbnb" || input.channel === "Direct" || input.channel === "Vrbo" ? input.channel : "all";
  const view = isDemoView(input.view) ? input.view : "overview";
  const stays = buildStays(selected, today);
  const carts = buildCarts(selected, stays, today);
  const end = windowEndIso(today);
  const activeChannel = view === "calendar" || view === "reservations" ? channel : "all";
  const bounds = gridBounds(month);
  const calendarStays = stays.filter(
    (stay) => overlapsRange(stay.arrival, stay.departure, bounds.start, bounds.end) && matchesChannel(stay, activeChannel),
  );
  const calendarCarts = carts.filter((cart) => overlapsRange(cart.start, cart.end, bounds.start, bounds.end));
  const upcoming = stays
    .filter((stay) => stay.departure > today && stay.arrival < end)
    .sort((a, b) => a.arrival.localeCompare(b.arrival) || a.guest.localeCompare(b.guest));
  const recent = stays
    .filter((stay) => stay.departure <= today)
    .sort((a, b) => b.departure.localeCompare(a.departure) || a.guest.localeCompare(b.guest));
  const occupancy = [thisMonth, nextMonth].map((key, index) => ({
    ...occupancyForMonth(
      key,
      stays.map((stay) => ({
        arrival: stay.arrival,
        departure: stay.departure,
        kind: stay.tone === "owner" ? ("owner" as const) : ("guest" as const),
      })),
    ),
    label: formatMonth(key),
    when: index === 0 ? ("This month" as const) : ("Next month" as const),
  }));
  const payoutFor = (key: string) =>
    stays.filter((stay) => payable(stay) && stay.departure.startsWith(key)).reduce((sum, stay) => sum + stay.ownerPayout, 0);
  const statements = buildStatements(stays, today);
  const openStatement =
    statements.find((statement) => statement.month === input.statement) ??
    statements.find((statement) => statement.month === thisMonth) ??
    statements[0] ??
    null;
  const inHouse =
    stays
      .filter((stay) => stay.arrival <= today && today < stay.departure)
      .sort((a, b) => b.arrival.localeCompare(a.arrival))[0] ?? null;

  return {
    ownerName: DEMO_OWNER_NAME,
    ownerLabel: DEMO_OWNER_LABEL,
    fetchedAt: input.now.toISOString(),
    today,
    view,
    scope,
    properties,
    selected,
    month,
    months,
    channel,
    occupancy,
    payoutSummary: {
      thisMonth: payoutFor(thisMonth),
      nextMonth: payoutFor(nextMonth),
      onTheBooks: stays
        .filter((stay) => payable(stay) && stay.departure > today && stay.arrival < end)
        .reduce((sum, stay) => sum + stay.ownerPayout, 0),
      thisLabel: formatMonth(thisMonth),
      nextLabel: formatMonth(nextMonth),
    },
    inHouse,
    calendarStays,
    calendarCarts,
    upcoming,
    recent,
    reservationUpcoming: upcoming.filter((stay) => matchesChannel(stay, activeChannel)),
    reservationRecent: recent.filter((stay) => matchesChannel(stay, activeChannel)),
    selectedStay: stays.find((stay) => stay.id === input.stay) ?? null,
    statements,
    openStatement,
    showGolfCart: selected.hasGolfCart,
  };
}

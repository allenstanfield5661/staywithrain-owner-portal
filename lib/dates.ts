export type YMD = { y: number; m: number; d: number };

export const GULF_TZ = "America/Chicago";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_NARROW = ["S", "M", "T", "W", "T", "F", "S"];

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function parseISODate(iso: string): YMD {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) throw new Error(`Invalid date: ${iso}`);
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) throw new Error(`Invalid date: ${iso}`);
  return { y, m, d };
}

export function isoDate(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function compareISO(a: string, b: string): number {
  const left = a.slice(0, 10);
  const right = b.slice(0, 10);
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function addDays(iso: string, days: number): string {
  const { y, m, d } = parseISODate(iso);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return isoDate(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addMonths(y: number, m: number, delta: number): { y: number; m: number } {
  const index = y * 12 + (m - 1) + delta;
  return { y: Math.floor(index / 12), m: (index % 12) + 1 };
}

export function weekdayIndex(iso: string): number {
  const { y, m, d } = parseISODate(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Nights occupied by a stay: arrival inclusive, departure exclusive. */
export function eachNight(arrival: string, departure: string): string[] {
  const nights: string[] = [];
  let cursor = arrival.slice(0, 10);
  const end = departure.slice(0, 10);
  if (!(cursor < end)) return nights;
  for (let i = 0; i < 400 && cursor < end; i += 1) {
    nights.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return nights;
}

export function todayInTimeZone(timeZone: string, now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((part) => part.type === "year")?.value;
  const m = parts.find((part) => part.type === "month")?.value;
  const d = parts.find((part) => part.type === "day")?.value;
  if (!y || !m || !d) throw new Error("Could not resolve today's date");
  return `${y}-${m}-${d}`;
}

export function monthKey(y: number, m: number): string {
  return `${y}-${pad(m)}`;
}

/** Six months beginning at November 2026, or at the current month once that is later. */
export function windowMonths(today: string, count = 6): string[] {
  const parsed = parseISODate(today);
  let start = { y: parsed.y, m: parsed.m };
  if (parsed.y < 2026 || (parsed.y === 2026 && parsed.m < 11)) {
    start = { y: 2026, m: 11 };
  }
  const months: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const next = addMonths(start.y, start.m, i);
    months.push(monthKey(next.y, next.m));
  }
  return months;
}

export function reportingMonths(today: string, months: string[]): [string, string] {
  const current = today.slice(0, 7);
  const index = months.indexOf(current);
  if (index >= 0) {
    return [months[index], months[Math.min(index + 1, months.length - 1)]];
  }
  return [months[0], months[Math.min(1, months.length - 1)]];
}

export function formatMonth(month: string): string {
  const { y, m } = parseISODate(`${month}-01`);
  return `${MONTHS[m - 1]} ${y}`;
}

export function formatMonthShort(month: string): string {
  const { y, m } = parseISODate(`${month}-01`);
  return `${MONTHS_SHORT[m - 1]} ${y}`;
}

export function formatWeekday(iso: string, style: "short" | "narrow" = "short"): string {
  const index = weekdayIndex(iso);
  return style === "narrow" ? WEEKDAYS_NARROW[index] : WEEKDAYS_SHORT[index];
}

export function formatStayDate(iso: string): string {
  const { y, m, d } = parseISODate(iso);
  return `${WEEKDAYS_SHORT[weekdayIndex(iso)]}, ${MONTHS_SHORT[m - 1]} ${d}, ${y}`;
}

export function monthGrid(month: string): { iso: string; inMonth: boolean }[][] {
  const { y, m } = parseISODate(`${month}-01`);
  const first = isoDate(y, m, 1);
  const lead = weekdayIndex(first);
  const dim = daysInMonth(y, m);
  const cells: { iso: string; inMonth: boolean }[] = [];
  for (let i = 0; i < lead; i += 1) {
    cells.push({ iso: addDays(first, i - lead), inMonth: false });
  }
  for (let d = 1; d <= dim; d += 1) {
    cells.push({ iso: isoDate(y, m, d), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ iso: addDays(cells[cells.length - 1].iso, 1), inMonth: false });
  }
  const weeks: { iso: string; inMonth: boolean }[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function formatTimestamp(iso: string, timeZone = GULF_TZ): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

export function dayNumber(iso: string): number {
  return parseISODate(iso).d;
}

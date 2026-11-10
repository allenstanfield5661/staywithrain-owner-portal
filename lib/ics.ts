import {
  assignCartEvent,
  extractCartTag,
  isSubediCalendar,
  knownCartTags,
  type CartAssignment,
} from "@/lib/cart-match";
import type { Unit } from "@/lib/catalog";
import { addDays, isoDate, todayInTimeZone, GULF_TZ } from "@/lib/dates";
import { redactEventLabel } from "@/lib/privacy";

export type TagMapping = {
  tag: string;
  unitId: string;
};

export type ParsedCart = {
  id: string;
  unitId: string;
  tag: string;
  label: string;
  start: string;
  end: string;
};

export type ParsedCalendar = {
  calendarName: string | null;
  events: ParsedCart[];
  unmatched: number;
};

export type PushedCartEvent = {
  calendar?: string;
  summary: string;
  start: string;
  end: string;
};

function unfold(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "");
}

function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function normalizeApostrophes(value: string): string {
  return value.normalize("NFKC").replace(/[’‘ʼ]/g, "'");
}

/** Exact tag match: only full parenthetical groups count, longest tags first. */
export function matchTag(summary: string, mappings: TagMapping[]): TagMapping | null {
  const tag = extractCartTag(
    summary,
    mappings.map((mapping) => mapping.tag),
  );
  if (!tag) return null;
  const needle = normalizeApostrophes(tag).toLowerCase();
  return (
    mappings.find((mapping) => normalizeApostrophes(mapping.tag).toLowerCase() === needle) ?? null
  );
}

type Prop = { value: string; params: string };

function parseProps(block: string): Record<string, Prop> {
  const props: Record<string, Prop> = {};
  for (const line of block.split("\n")) {
    if (!line || line.startsWith("BEGIN:") || line.startsWith("END:")) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const left = line.slice(0, idx);
    const value = unescapeText(line.slice(idx + 1).trim());
    const [name, ...paramParts] = left.split(";");
    props[name.toUpperCase()] = { value, params: paramParts.join(";") };
  }
  return props;
}

function parseDateToken(value: string): { y: number; m: number; d: number; hour: number; minute: number; second: number; utc: boolean } | null {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/.exec(value);
  if (!match) return null;
  return {
    y: Number(match[1]),
    m: Number(match[2]),
    d: Number(match[3]),
    hour: match[4] ? Number(match[4]) : 0,
    minute: match[5] ? Number(match[5]) : 0,
    second: match[6] ? Number(match[6]) : 0,
    utc: match[7] === "Z",
  };
}

function rangeFor(startProp: Prop, endProp: Prop | undefined): { start: string; end: string } | null {
  const startToken = parseDateToken(startProp.value);
  if (!startToken) return null;
  const allDay = /VALUE=DATE/i.test(startProp.params) && !startProp.value.includes("T");
  if (allDay) {
    const start = isoDate(startToken.y, startToken.m, startToken.d);
    const endToken = endProp ? parseDateToken(endProp.value) : null;
    const end = endToken
      ? isoDate(endToken.y, endToken.m, endToken.d)
      : addDays(start, 1);
    if (!(start < end)) return { start, end: addDays(start, 1) };
    return { start, end };
  }
  const startMs = startToken.utc
    ? Date.UTC(startToken.y, startToken.m - 1, startToken.d, startToken.hour, startToken.minute, startToken.second)
    : Date.UTC(startToken.y, startToken.m - 1, startToken.d);
  const start = startToken.utc
    ? todayInTimeZone(GULF_TZ, new Date(startMs))
    : isoDate(startToken.y, startToken.m, startToken.d);
  if (!endProp) return { start, end: addDays(start, 1) };
  const endToken = parseDateToken(endProp.value);
  if (!endToken) return { start, end: addDays(start, 1) };
  if (endToken.utc) {
    const endMs = Date.UTC(endToken.y, endToken.m - 1, endToken.d, endToken.hour, endToken.minute, endToken.second);
    const inclusive = todayInTimeZone(GULF_TZ, new Date(endMs - 1));
    const end = addDays(inclusive, 1);
    return start < end ? { start, end } : { start, end: addDays(start, 1) };
  }
  const end = isoDate(endToken.y, endToken.m, endToken.d);
  if (start < end) return { start, end };
  return { start, end: addDays(start, 1) };
}

type EventAssignment = { unitIds: string[]; tag: string; label: string } | null;

function parseIcsWithAssigner(ics: string, assign: (summary: string) => EventAssignment): ParsedCalendar {
  const text = unfold(ics);
  const nameMatch = /X-WR-CALNAME:(.*)/i.exec(text);
  const calendarName = nameMatch ? unescapeText(nameMatch[1].trim()) : null;
  const blocks = text.split("BEGIN:VEVENT").slice(1);
  const events: ParsedCart[] = [];
  let unmatched = 0;
  blocks.forEach((block, index) => {
    const body = block.split("END:VEVENT")[0] ?? "";
    const props = parseProps(body);
    const summary = props.SUMMARY?.value?.trim() ?? "";
    const startProp = props.DTSTART;
    const eventStatus = props.STATUS?.value?.trim().toLowerCase() ?? "";
    if (eventStatus === "cancelled" || eventStatus === "canceled") return;
    if (!summary || !startProp) {
      unmatched += 1;
      return;
    }
    const assignment = assign(summary);
    if (!assignment || assignment.unitIds.length === 0) {
      unmatched += 1;
      return;
    }
    const range = rangeFor(startProp, props.DTEND);
    if (!range) {
      unmatched += 1;
      return;
    }
    const uid = props.UID?.value?.trim() || `${assignment.unitIds[0]}-${range.start}-${index}`;
    for (const unitId of assignment.unitIds) {
      events.push({
        id: assignment.unitIds.length === 1 ? uid : `${uid}:${unitId}`,
        unitId,
        tag: assignment.tag,
        label: assignment.label,
        start: range.start,
        end: range.end,
      });
    }
  });
  return { calendarName, events, unmatched };
}

export function parseIcs(ics: string, mappings: TagMapping[]): ParsedCalendar {
  return parseIcsWithAssigner(ics, (summary) => {
    const mapping = matchTag(summary, mappings);
    if (!mapping) return null;
    return {
      unitIds: [mapping.unitId],
      tag: mapping.tag,
      label: redactEventLabel(summary, mapping.tag),
    };
  });
}

/** Match cart rentals by the cart TAG in the title. Subedi Realty Golf Cart events are always cart (19). */
export function parseIcsForUnits(ics: string, units: Unit[]): ParsedCalendar {
  const text = unfold(ics);
  const nameMatch = /X-WR-CALNAME:(.*)/i.exec(text);
  const calendarName = nameMatch ? unescapeText(nameMatch[1].trim()) : null;
  const subedi = isSubediCalendar(calendarName);
  return parseIcsWithAssigner(ics, (summary) => {
    const options = subedi ? { forceTag: "(19)" } : undefined;
    return assignCartEvent(summary, units, options) as CartAssignment | null;
  });
}

/** Turn a pushed JSON event list into parsed cart rentals using the same tag rules. */
export function parsePushedCartEvents(raw: PushedCartEvent[], units: Unit[]): ParsedCalendar {
  const events: ParsedCart[] = [];
  let unmatched = 0;
  let calendarName: string | null = null;
  raw.forEach((item, index) => {
    const summary = String(item.summary ?? "").trim();
    const start = String(item.start ?? "").trim();
    const end = String(item.end ?? "").trim();
    if (item.calendar && !calendarName) calendarName = String(item.calendar);
    if (!summary || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || !(start < end)) {
      unmatched += 1;
      return;
    }
    const subedi = isSubediCalendar(item.calendar);
    const assignment = assignCartEvent(summary, units, subedi ? { forceTag: "(19)" } : undefined);
    if (!assignment || assignment.unitIds.length === 0) {
      unmatched += 1;
      return;
    }
    for (const unitId of assignment.unitIds) {
      events.push({
        id: `push-${index}-${unitId}-${start}`,
        unitId,
        tag: assignment.tag,
        label: assignment.label,
        start,
        end,
      });
    }
  });
  return { calendarName: calendarName ?? "STR Golf Cart Rentals", events, unmatched };
}

export function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function renderIcs(
  events: { uid: string; start: string; end: string; summary: string; timed?: boolean }[],
  calendarName = "STR Golf Cart Rentals",
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rain Stanfield//Owner Portal Preview//EN",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
  ];
  for (const event of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.uid}`);
    const start = event.start.replace(/-/g, "");
    const end = event.end.replace(/-/g, "");
    if (event.timed) {
      lines.push(`DTSTART:${start}T150000Z`);
      lines.push(`DTEND:${end}T210000Z`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${start}`);
      lines.push(`DTEND;VALUE=DATE:${end}`);
    }
    lines.push(`SUMMARY:${escapeIcsText(event.summary)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

// Re-export for tests that probe known tags.
export { knownCartTags };

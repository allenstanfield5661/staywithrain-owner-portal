import { addDays, eachNight } from "@/lib/dates";

export type CalendarTone = "guest" | "owner" | "pending" | "cart";

export type CalendarEvent = {
  id: string;
  start: string;
  end: string;
  label: string;
  tone: CalendarTone;
};

export type CalendarBar = {
  id: string;
  label: string;
  tone: CalendarTone;
  col: number;
  span: number;
  lane: number;
  roundStart: boolean;
  roundEnd: boolean;
};

export function barsForWeek(week: { iso: string }[], events: CalendarEvent[]): CalendarBar[] {
  if (week.length !== 7) return [];
  const start = week[0].iso;
  const end = addDays(week[6].iso, 1);
  const segments: Omit<CalendarBar, "lane">[] = [];
  for (const event of events) {
    const segStart = event.start > start ? event.start : start;
    const segEnd = event.end < end ? event.end : end;
    if (!(segStart < segEnd)) continue;
    segments.push({
      id: event.id,
      label: event.label,
      tone: event.tone,
      col: eachNight(start, segStart).length,
      span: eachNight(segStart, segEnd).length,
      roundStart: event.start >= start && event.start < end,
      roundEnd: event.end > start && event.end <= end,
    });
  }
  segments.sort((a, b) => a.col - b.col || b.span - a.span || a.label.localeCompare(b.label));
  const laneEnds: number[] = [];
  return segments.map((segment) => {
    const segEndCol = segment.col + segment.span;
    let lane = laneEnds.findIndex((endCol) => endCol <= segment.col);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(segEndCol);
    } else {
      laneEnds[lane] = segEndCol;
    }
    return { ...segment, lane };
  });
}

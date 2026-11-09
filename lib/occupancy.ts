import { daysInMonth, eachNight, parseISODate } from "@/lib/dates";

export type OccupancyStay = {
  arrival: string;
  departure: string;
  kind: "guest" | "owner";
};

export type Occupancy = {
  month: string;
  total: number;
  guestNights: number;
  ownerNights: number;
  percent: number;
};

/** Guest nights ÷ nights in the month. A night counts once. Owner blocks are separate. */
export function occupancyForMonth(month: string, stays: OccupancyStay[]): Occupancy {
  const { y, m } = parseISODate(`${month}-01`);
  const total = daysInMonth(y, m);
  const guest = new Set<string>();
  const owner = new Set<string>();
  for (const stay of stays) {
    for (const night of eachNight(stay.arrival, stay.departure)) {
      if (!night.startsWith(`${month}-`)) continue;
      if (stay.kind === "owner") owner.add(night);
      else guest.add(night);
    }
  }
  for (const night of guest) owner.delete(night);
  const guestNights = guest.size;
  const ownerNights = owner.size;
  const percent = total === 0 ? 0 : Math.round((guestNights / total) * 100);
  return { month, total, guestNights, ownerNights, percent };
}

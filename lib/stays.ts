import { eachNight } from "@/lib/dates";
import { redactGuestName } from "@/lib/privacy";

export type RawStay = {
  id: string;
  unitId: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  arrival: string;
  departure: string;
  channel: string;
  status: string;
};

export type PublicStay = {
  id: string;
  unitId: string;
  guest: string;
  arrival: string;
  departure: string;
  nights: number;
  channel: string;
  tone: "guest" | "owner" | "pending";
  statusLabel: string;
};

const EXCLUDED = new Set([
  "cancelled",
  "canceled",
  "declined",
  "expired",
]);

export function normalizeStatus(status: string | null | undefined): string {
  return (status ?? "").replace(/[\s_-]/g, "").toLowerCase();
}

/** Drop cancelled, declined, inquiry (including inquiry* variants), and expired holds. */
export function isExcludedStatus(status: string | null | undefined): boolean {
  const normalized = normalizeStatus(status);
  if (!normalized) return true;
  if (normalized.startsWith("inquiry")) return true;
  return EXCLUDED.has(normalized);
}

export function presentStatus(status: string): Pick<PublicStay, "tone" | "statusLabel"> {
  const normalized = normalizeStatus(status);
  if (normalized === "ownerstay") return { tone: "owner", statusLabel: "Owner stay" };
  if (normalized === "modified") return { tone: "guest", statusLabel: "Updated" };
  if (normalized === "awaitingpayment") return { tone: "pending", statusLabel: "Awaiting payment" };
  if (normalized === "awaitingguestverification") return { tone: "pending", statusLabel: "Verifying" };
  if (normalized === "pending" || normalized === "unconfirmed") {
    return { tone: "pending", statusLabel: "Pending" };
  }
  return { tone: "guest", statusLabel: "Confirmed" };
}

export function displayChannel(channel: string | null | undefined, tone: PublicStay["tone"]): string {
  if (tone === "owner") return "Owner";
  const value = (channel ?? "").toLowerCase();
  if (value.includes("airbnb")) return "Airbnb";
  if (value.includes("homeaway") || value.includes("vrbo")) return "Vrbo";
  if (value.includes("booking.com") || value.includes("bookingcom") || value === "booking") {
    return "Booking.com";
  }
  if (
    value.includes("direct") ||
    value.includes("bookingengine") ||
    value.includes("manual") ||
    value === "owner"
  ) {
    return "Direct";
  }
  if (value.includes("expedia")) return "Expedia";
  if (value.includes("marriott")) return "Marriott";
  if (value.includes("google")) return "Google";
  if (!value.trim()) return "Direct";
  return "Other";
}

export function toPublicStay(stay: RawStay): PublicStay | null {
  if (isExcludedStatus(stay.status)) return null;
  const arrival = stay.arrival.slice(0, 10);
  const departure = stay.departure.slice(0, 10);
  const nights = eachNight(arrival, departure).length;
  if (nights <= 0) return null;
  const presentation = presentStatus(stay.status);
  const guest =
    presentation.tone === "owner"
      ? "Owner"
      : redactGuestName(stay.firstName, stay.lastName, stay.fullName);
  return {
    id: stay.id,
    unitId: stay.unitId,
    guest,
    arrival,
    departure,
    nights,
    channel: displayChannel(stay.channel, presentation.tone),
    tone: presentation.tone,
    statusLabel: presentation.statusLabel,
  };
}

export function staysOverlap(a: { arrival: string; departure: string }, b: { arrival: string; departure: string }): boolean {
  return a.arrival < b.departure && b.arrival < a.departure;
}

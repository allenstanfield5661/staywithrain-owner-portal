import { normalizeName, type Unit } from "@/lib/catalog";
import { addDays } from "@/lib/dates";
import { toPublicStay, type PublicStay, type RawStay } from "@/lib/stays";
import { CACHE_TTL_MS, clearTimedCache, remember } from "@/lib/timed-cache";

const API_BASE = "https://api.hostaway.com/v1";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

let fetchImpl: FetchLike = (input, init) => fetch(input, init);

export function setHostawayFetchForTests(next: FetchLike | null): void {
  fetchImpl = next ?? ((input, init) => fetch(input, init));
  clearTimedCache();
}

type HostawayListing = {
  id?: number | string;
  name?: string;
  internalListingName?: string;
  city?: string | null;
  bedroomsNumber?: number | null;
};

type HostawayReservation = {
  id?: number | string;
  listingMapId?: number | string;
  guestName?: string | null;
  guestFirstName?: string | null;
  guestLastName?: string | null;
  arrivalDate?: string | null;
  departureDate?: string | null;
  status?: string | null;
  channelName?: string | null;
  source?: string | null;
  [key: string]: unknown;
};

export function matchListing(unit: Unit, listings: HostawayListing[]): HostawayListing | undefined {
  if (unit.hostawayListingId != null) {
    return listings.find((listing) => String(listing.id) === String(unit.hostawayListingId));
  }
  const target = normalizeName(unit.name);
  return listings.find((listing) => {
    const names = [listing.name, listing.internalListingName].filter((name): name is string => Boolean(name));
    return names.some((name) => normalizeName(name) === target);
  });
}

/** Dates, nights, status, channel, and a shortened name. Contact, payment, and price fields are ignored. */
export function mapHostawayReservation(raw: HostawayReservation, unitId: string): PublicStay | null {
  if (!raw.arrivalDate || !raw.departureDate || raw.id == null) return null;
  const stay: RawStay = {
    id: `hostaway-${raw.id}`,
    unitId,
    firstName: raw.guestFirstName ?? "",
    lastName: raw.guestLastName ?? "",
    fullName: raw.guestName ?? undefined,
    arrival: raw.arrivalDate,
    departure: raw.departureDate,
    channel: raw.channelName || raw.source || "",
    status: raw.status ?? "",
  };
  return toPublicStay(stay);
}

async function fetchJson(url: string, token: string): Promise<unknown> {
  const response = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Cache-Control": "no-cache",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 401 || response.status === 403) {
    clearTimedCache();
    throw new Error("Hostaway refused the access token. Check HOSTAWAY_ACCOUNT_ID and HOSTAWAY_API_KEY.");
  }
  if (!response.ok) {
    throw new Error(`Hostaway request failed (${response.status}).`);
  }
  return response.json();
}

async function requestHostawayToken(): Promise<string> {
  const accountId = process.env.HOSTAWAY_ACCOUNT_ID;
  const apiKey = process.env.HOSTAWAY_API_KEY;
  if (!accountId || !apiKey) {
    throw new Error("Set HOSTAWAY_ACCOUNT_ID and HOSTAWAY_API_KEY.");
  }
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: accountId,
    client_secret: apiKey,
    scope: "general",
  });
  const response = await fetchImpl(`${API_BASE}/accessTokens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    throw new Error(`Hostaway could not issue an access token (${response.status}).`);
  }
  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) throw new Error("Hostaway did not return an access token.");
  return payload.access_token;
}

export async function getHostawayToken(): Promise<string> {
  return remember("hostaway-token", CACHE_TTL_MS, requestHostawayToken);
}

async function fetchPaged(path: string, token: string, params: Record<string, string>): Promise<unknown[]> {
  const collected: unknown[] = [];
  let offset = 0;
  for (let page = 0; page < 40; page += 1) {
    const url = new URL(`${API_BASE}${path}`);
    url.searchParams.set("limit", "100");
    url.searchParams.set("offset", String(offset));
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const payload = (await fetchJson(url.toString(), token)) as { result?: unknown[] };
    const result = Array.isArray(payload.result) ? payload.result : [];
    collected.push(...result);
    if (result.length < 100) break;
    offset += 100;
  }
  return collected;
}

export function listingToUnit(listing: HostawayListing): Unit | null {
  if (listing.id == null) return null;
  const bedrooms = Number(listing.bedroomsNumber);
  return {
    id: String(listing.id),
    name: listing.name || listing.internalListingName || `Listing ${listing.id}`,
    town: listing.city?.trim() || "Mississippi Gulf Coast",
    bedrooms: Number.isFinite(bedrooms) && bedrooms > 0 ? bedrooms : 1,
    hostawayListingId: Number(listing.id),
  };
}

async function fetchLiveCalendar(windowStart: string, windowEnd: string): Promise<{
  stays: PublicStay[];
  units: Unit[];
}> {
  const token = await getHostawayToken();
  const listings = (await fetchPaged("/listings", token, {})) as HostawayListing[];
  const units = listings.flatMap((listing) => {
    const unit = listingToUnit(listing);
    return unit ? [unit] : [];
  });
  const arrivalStart = addDays(windowStart, -120);
  const stays: PublicStay[] = [];
  for (const unit of units) {
    const reservations = (await fetchPaged("/reservations", token, {
      listingId: unit.id,
      arrivalStartDate: arrivalStart,
      arrivalEndDate: windowEnd,
    })) as HostawayReservation[];
    for (const reservation of reservations) {
      if (String(reservation.listingMapId ?? "") !== unit.id) continue;
      const stay = mapHostawayReservation(reservation, unit.id);
      if (!stay) continue;
      if (stay.departure <= windowStart || stay.arrival >= windowEnd) continue;
      stays.push(stay);
    }
  }
  return { stays, units };
}

export async function loadLiveCalendar(windowStart: string, windowEnd: string): Promise<{
  stays: PublicStay[];
  units: Unit[];
}> {
  return remember(`hostaway-calendar:${windowStart}:${windowEnd}`, CACHE_TTL_MS, () =>
    fetchLiveCalendar(windowStart, windowEnd),
  );
}

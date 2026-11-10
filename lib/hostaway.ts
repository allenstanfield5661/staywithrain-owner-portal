import { normalizeName, type Unit } from "@/lib/catalog";
import { addDays } from "@/lib/dates";
import { toPublicStay, type PublicStay, type RawStay } from "@/lib/stays";
import { CACHE_TTL_MS, clearTimedCache, remember } from "@/lib/timed-cache";

const API_BASE = "https://api.hostaway.com/v1";
const PAGE_SIZE = 500;
const PAGE_CONCURRENCY = 4;
const REQUEST_TIMEOUT_MS = 8000;
const CALENDAR_BUDGET_MS = 20000;
const MAX_RETRIES = 3;

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
  street?: string | null;
  address?: string | null;
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

type HostawayListResponse = {
  result?: unknown[];
  count?: number;
};

export type LiveCalendar = {
  stays: PublicStay[];
  units: Unit[];
  warning?: string;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function remainingMs(deadline: number): number {
  return Math.max(0, deadline - Date.now());
}

class HostawayAuthError extends Error {}

async function fetchJson(url: string, token: string, deadline: number): Promise<unknown> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const budget = remainingMs(deadline);
    if (budget < 250) break;
    try {
      const response = await fetchImpl(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(Math.min(REQUEST_TIMEOUT_MS, budget)),
      });
      if (response.status === 401 || response.status === 403) {
        clearTimedCache();
        throw new HostawayAuthError(
          "Hostaway refused the access token. Check HOSTAWAY_ACCOUNT_ID and HOSTAWAY_API_KEY.",
        );
      }
      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`Hostaway request failed (${response.status}).`);
        const retryAfter = Number(response.headers.get("retry-after"));
        const waitMs =
          Number.isFinite(retryAfter) && retryAfter >= 0
            ? Math.min(retryAfter * 1000, 4000)
            : 250 * 2 ** attempt;
        if (attempt < MAX_RETRIES && remainingMs(deadline) > waitMs + 250) {
          await sleep(waitMs);
          continue;
        }
        throw lastError;
      }
      if (!response.ok) {
        throw new Error(`Hostaway request failed (${response.status}).`);
      }
      return response.json();
    } catch (error) {
      if (error instanceof HostawayAuthError) throw error;
      lastError = error instanceof Error ? error : new Error("Hostaway request failed.");
      const waitMs = 250 * 2 ** attempt;
      if (attempt < MAX_RETRIES && remainingMs(deadline) > waitMs + 250) {
        await sleep(waitMs);
        continue;
      }
      throw lastError;
    }
  }
  throw lastError ?? new Error("Hostaway request failed.");
}

async function requestHostawayToken(deadline: number): Promise<string> {
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
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const budget = remainingMs(deadline);
    if (budget < 250) break;
    try {
      const response = await fetchImpl(`${API_BASE}/accessTokens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Cache-Control": "no-cache",
        },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(Math.min(REQUEST_TIMEOUT_MS, budget)),
      });
      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`Hostaway could not issue an access token (${response.status}).`);
        const waitMs = 250 * 2 ** attempt;
        if (attempt < MAX_RETRIES && remainingMs(deadline) > waitMs + 250) {
          await sleep(waitMs);
          continue;
        }
        throw lastError;
      }
      if (!response.ok) {
        throw new Error(`Hostaway could not issue an access token (${response.status}).`);
      }
      const payload = (await response.json()) as { access_token?: string };
      if (!payload.access_token) throw new Error("Hostaway did not return an access token.");
      return payload.access_token;
    } catch (error) {
      if (error instanceof Error && error.message.includes("did not return")) throw error;
      if (error instanceof Error && error.message.includes("could not issue") && !error.message.match(/\((429|5\d\d)\)/)) {
        throw error;
      }
      lastError = error instanceof Error ? error : new Error("Hostaway could not issue an access token.");
      const waitMs = 250 * 2 ** attempt;
      if (attempt < MAX_RETRIES && remainingMs(deadline) > waitMs + 250) {
        await sleep(waitMs);
        continue;
      }
      throw lastError;
    }
  }
  throw lastError ?? new Error("Hostaway could not issue an access token.");
}

export async function getHostawayToken(): Promise<string> {
  return remember("hostaway-token", CACHE_TTL_MS, () => requestHostawayToken(Date.now() + REQUEST_TIMEOUT_MS * 2));
}

function listUrl(path: string, params: Record<string, string>, offset: number, limit = PAGE_SIZE): string {
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

type PagedResult = { items: unknown[]; failed: number; truncated: boolean };

async function fetchPage(
  path: string,
  token: string,
  params: Record<string, string>,
  offset: number,
  deadline: number,
): Promise<{ items: unknown[]; count: number | null }> {
  const payload = (await fetchJson(listUrl(path, params, offset), token, deadline)) as HostawayListResponse;
  const items = Array.isArray(payload.result) ? payload.result : [];
  const count = typeof payload.count === "number" ? payload.count : null;
  return { items, count };
}

async function fetchPages(
  path: string,
  token: string,
  params: Record<string, string>,
  offsets: number[],
  deadline: number,
): Promise<{ byOffset: Map<number, unknown[]>; counts: Map<number, number | null>; failed: Set<number> }> {
  const byOffset = new Map<number, unknown[]>();
  const counts = new Map<number, number | null>();
  const failed = new Set<number>();
  let next = 0;
  const worker = async () => {
    while (next < offsets.length) {
      if (remainingMs(deadline) < 250) {
        for (let i = next; i < offsets.length; i += 1) failed.add(offsets[i]);
        return;
      }
      const index = next;
      next += 1;
      const offset = offsets[index];
      try {
        const page = await fetchPage(path, token, params, offset, deadline);
        byOffset.set(offset, page.items);
        counts.set(offset, page.count);
      } catch {
        failed.add(offset);
      }
    }
  };
  if (offsets.length === 0) return { byOffset, counts, failed };
  await Promise.all(Array.from({ length: Math.min(PAGE_CONCURRENCY, offsets.length) }, worker));
  return { byOffset, counts, failed };
}

function assemblePages(
  byOffset: Map<number, unknown[]>,
  failed: Set<number>,
  count: number | null,
): PagedResult {
  const items: unknown[] = [];
  const offsets = [...byOffset.keys()].sort((a, b) => a - b);
  for (const offset of offsets) {
    if (count != null && offset >= count) continue;
    items.push(...(byOffset.get(offset) ?? []));
  }
  const missingNeeded = count != null
    ? Array.from({ length: Math.ceil(count / PAGE_SIZE) }, (_, i) => i * PAGE_SIZE).some(
        (offset) => !byOffset.has(offset) || failed.has(offset),
      )
    : failed.size > 0;
  return { items, failed: failed.size, truncated: missingNeeded || failed.size > 0 };
}

async function fetchPaged(
  path: string,
  token: string,
  params: Record<string, string>,
  deadline: number,
  options?: { speculatePages?: number },
): Promise<PagedResult> {
  const speculatePages = Math.max(1, options?.speculatePages ?? 1);
  const firstWave = Array.from({ length: speculatePages }, (_, i) => i * PAGE_SIZE);
  const started = new Set(firstWave);
  const firstWaveResult = await fetchPages(path, token, params, firstWave, deadline);
  if (!firstWaveResult.byOffset.has(0)) {
    throw new Error("Hostaway request failed.");
  }
  const firstItems = firstWaveResult.byOffset.get(0) ?? [];
  const count = firstWaveResult.counts.get(0) ?? null;
  if (firstItems.length < PAGE_SIZE && (count == null || count <= firstItems.length)) {
    return { items: firstItems, failed: 0, truncated: false };
  }

  const byOffset = new Map(firstWaveResult.byOffset);
  const failed = new Set(firstWaveResult.failed);
  const extra: number[] = [];
  if (count != null) {
    for (let offset = PAGE_SIZE; offset < count; offset += PAGE_SIZE) {
      if (!started.has(offset)) extra.push(offset);
    }
  } else {
    let offset = speculatePages * PAGE_SIZE;
    for (let page = speculatePages; page < 40 && remainingMs(deadline) >= 250; page += 1) {
      try {
        const nextPage = await fetchPage(path, token, params, offset, deadline);
        byOffset.set(offset, nextPage.items);
        if (nextPage.items.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      } catch {
        failed.add(offset);
        break;
      }
    }
    return assemblePages(byOffset, failed, count);
  }

  if (extra.length > 0) {
    const more = await fetchPages(path, token, params, extra, deadline);
    for (const [offset, items] of more.byOffset) byOffset.set(offset, items);
    for (const offset of more.failed) failed.add(offset);
  }
  return assemblePages(byOffset, failed, count);
}

function uniqueAliases(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const aliases: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    aliases.push(trimmed);
  }
  return aliases;
}

export function listingToUnit(listing: HostawayListing): Unit | null {
  if (listing.id == null) return null;
  const bedrooms = Number(listing.bedroomsNumber);
  const name = listing.name || listing.internalListingName || `Listing ${listing.id}`;
  const aliases = uniqueAliases([listing.internalListingName, listing.street, listing.address]);
  return {
    id: String(listing.id),
    name,
    town: listing.city?.trim() || "Mississippi Gulf Coast",
    bedrooms: Number.isFinite(bedrooms) && bedrooms > 0 ? bedrooms : 1,
    hostawayListingId: Number(listing.id),
    aliases: aliases.filter((alias) => alias.toLowerCase() !== name.toLowerCase()),
  };
}

function mapStays(
  reservations: HostawayReservation[],
  unitIds: Set<string>,
  windowStart: string,
  windowEnd: string,
): PublicStay[] {
  const stays: PublicStay[] = [];
  for (const reservation of reservations) {
    const unitId = String(reservation.listingMapId ?? "");
    if (!unitIds.has(unitId)) continue;
    const stay = mapHostawayReservation(reservation, unitId);
    if (!stay) continue;
    if (stay.departure <= windowStart || stay.arrival >= windowEnd) continue;
    stays.push(stay);
  }
  return stays;
}

async function fetchLiveCalendar(windowStart: string, windowEnd: string): Promise<LiveCalendar> {
  const started = Date.now();
  const deadline = started + CALENDAR_BUDGET_MS;
  const token = await remember("hostaway-token", CACHE_TTL_MS, () => requestHostawayToken(deadline));
  const arrivalStart = addDays(windowStart, -120);
  const reservationParams = {
    arrivalStartDate: arrivalStart,
    arrivalEndDate: windowEnd,
  };

  const [listingsResult, reservationsSettled] = await Promise.all([
    fetchPaged("/listings", token, {}, deadline),
    fetchPaged("/reservations", token, reservationParams, deadline, { speculatePages: 4 }).catch(
      (error: unknown): PagedResult | Error => (error instanceof Error ? error : new Error("Hostaway request failed.")),
    ),
  ]);
  const units = (listingsResult.items as HostawayListing[]).flatMap((listing) => {
    const unit = listingToUnit(listing);
    return unit ? [unit] : [];
  });
  if (units.length === 0) {
    throw new Error("Hostaway returned no listings.");
  }

  if (reservationsSettled instanceof Error) {
    throw reservationsSettled;
  }
  const reservationsResult = reservationsSettled;
  const unitIds = new Set(units.map((unit) => unit.id));
  const stays = mapStays(reservationsResult.items as HostawayReservation[], unitIds, windowStart, windowEnd);
  if (stays.length === 0 && reservationsResult.failed > 0) {
    throw new Error("Hostaway bookings could not be loaded in time. Try again in a moment.");
  }

  const warningParts: string[] = [];
  if (listingsResult.truncated || listingsResult.failed > 0) {
    warningParts.push("Some listings may be missing.");
  }
  if (reservationsResult.truncated || reservationsResult.failed > 0) {
    warningParts.push("Some bookings could not be loaded in time. Try again in a moment.");
  }
  const warning = warningParts.length > 0 ? warningParts.join(" ") : undefined;
  console.info(
    `Hostaway calendar: ${units.length} listings, ${stays.length} stays, ${Date.now() - started}ms${warning ? ", partial" : ""}`,
  );
  return { stays, units, warning };
}

export async function loadLiveCalendar(windowStart: string, windowEnd: string): Promise<LiveCalendar> {
  return remember(
    `hostaway-calendar:${windowStart}:${windowEnd}`,
    CACHE_TTL_MS,
    () => fetchLiveCalendar(windowStart, windowEnd),
    { shouldPersist: (value) => !value.warning },
  );
}

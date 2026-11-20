import { afterEach, describe, expect, it } from "vitest";
import { authenticate } from "@/lib/authenticate";
import { buildPortalView } from "@/lib/view";
import { clearTimedCache, remember, setTimedCacheForTests } from "@/lib/timed-cache";
import { readCachedSnapshot, snapshotCacheKey, warmSnapshot } from "@/lib/snapshot";
import { withTimeout } from "@/lib/timeout";
import { loadLiveCalendar, setHostawayFetchForTests } from "@/lib/hostaway";
import { createInviteToken, readInviteToken } from "@/lib/invites";
import { resetTestOwners, useTestOwners, type StoredOwner } from "@/lib/owner-store";
import { hashPassword } from "@/lib/passwords";
import { allowAttempt, clearRateLimits } from "@/lib/rate-limit";
import type { Snapshot } from "@/lib/snapshot";
import type { Unit } from "@/lib/catalog";

const NOW = new Date("2026-11-05T18:00:00Z");

const houses: Unit[] = [
  { id: "11", name: "Peaceful Pearl", town: "Ocean Springs", bedrooms: 4, hostawayListingId: 11 },
  { id: "19", name: "Porter Pulse #19", town: "Gulfport", bedrooms: 2, hostawayListingId: 19 },
];

function snapshot(): Snapshot {
  return {
    fetchedAt: NOW.toISOString(),
    source: "live",
    cartSource: "ics",
    matchedUnitIds: ["11", "19"],
    units: houses,
    stays: [
      {
        id: "stay-11",
        unitId: "11",
        guest: "Camille D.",
        arrival: "2026-11-03",
        departure: "2026-11-08",
        nights: 5,
        channel: "Airbnb",
        tone: "guest",
        statusLabel: "Confirmed",
      },
      {
        id: "stay-19",
        unitId: "19",
        guest: "Hidden H.",
        arrival: "2026-11-04",
        departure: "2026-11-09",
        nights: 5,
        channel: "Vrbo",
        tone: "guest",
        statusLabel: "Confirmed",
      },
    ],
    carts: [
      { id: "cart-19", unitId: "19", tag: "(19)", label: "Kenji S.", start: "2026-11-04", end: "2026-11-06" },
    ],
    unmatchedCarts: 0,
  };
}

describe("owner scoping", () => {
  it("ignores a tampered listing id and hides the other owner's stays", () => {
    const view = buildPortalView({
      account: { id: "owner-a", name: "Owner A", email: "a@example.com", role: "owner" },
      units: houses,
      assignments: { "11": "owner-a", "19": "owner-b" },
      snapshot: snapshot(),
      unit: "19",
      now: NOW,
    });
    expect(view.selected?.id).toBe("11");
    expect(view.units.map((unit) => unit.id)).toEqual(["11"]);
    expect(view.calendarStays.map((stay) => stay.id)).toEqual(["stay-11"]);
    expect(view.upcoming.map((stay) => stay.guest)).toEqual(["Camille D."]);
    expect(view.calendarCarts).toEqual([]);
    expect(JSON.stringify(view)).not.toContain("Hidden H.");
    expect(JSON.stringify(view)).not.toContain("stay-19");
  });
});

describe("auth", () => {
  afterEach(() => {
    resetTestOwners();
    clearRateLimits();
    delete process.env.DATA_MODE;
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD_HASH;
    delete process.env.SESSION_SECRET;
  });

  it("accepts a hashed owner password and rejects the wrong one", async () => {
    process.env.DATA_MODE = "live";
    process.env.SESSION_SECRET = "test-secret";
    const owner: StoredOwner = {
      id: "owner-a",
      name: "Owner A",
      email: "a@example.com",
      passwordHash: await hashPassword("coastal-key"),
      listingIds: ["11"],
    };
    useTestOwners([owner]);
    expect((await authenticate("a@example.com", "coastal-key"))?.id).toBe("owner-a");
    expect(await authenticate("a@example.com", "nope")).toBeNull();
    expect(await authenticate("other@example.com", "coastal-key")).toBeNull();
  });

  it("accepts the admin hash from the environment", async () => {
    process.env.DATA_MODE = "live";
    process.env.ADMIN_EMAIL = "allen@raindev.com";
    process.env.ADMIN_PASSWORD_HASH = await hashPassword("admin-secret");
    useTestOwners([]);
    expect((await authenticate("Allen@RainDev.com", "admin-secret"))?.role).toBe("admin");
    expect(await authenticate("allen@raindev.com", "wrong-secret")).toBeNull();
  });

  it("expires and rejects tampered invite links", () => {
    process.env.SESSION_SECRET = "test-secret";
    const token = createInviteToken("a@example.com", Date.parse("2026-11-01T00:00:00Z"));
    expect(readInviteToken(token, Date.parse("2026-11-02T00:00:00Z"))?.email).toBe("a@example.com");
    expect(readInviteToken(token, Date.parse("2026-11-20T00:00:00Z"))).toBeNull();
    expect(readInviteToken(`${token}x`, Date.parse("2026-11-02T00:00:00Z"))).toBeNull();
  });

  it("stops repeated sign-in attempts", () => {
    const start = Date.parse("2026-11-05T00:00:00Z");
    for (let attempt = 0; attempt < 8; attempt += 1) {
      expect(allowAttempt("login:a@example.com", start + attempt)).toBe(true);
    }
    expect(allowAttempt("login:a@example.com", start + 8)).toBe(false);
  });
});

describe("Hostaway mapping", () => {
  afterEach(() => {
    setHostawayFetchForTests(null);
    clearTimedCache();
    delete process.env.HOSTAWAY_ACCOUNT_ID;
    delete process.env.HOSTAWAY_API_KEY;
  });

  it("uses client credentials, filters reservations, and drops private guest fields", async () => {
    process.env.HOSTAWAY_ACCOUNT_ID = "acct";
    process.env.HOSTAWAY_API_KEY = "secret-key";
    const calls: string[] = [];
    setHostawayFetchForTests(async (input, init) => {
      const url = String(input);
      calls.push(`${init?.method ?? "GET"} ${url} ${init?.body ?? ""}`);
      if (url.endsWith("/accessTokens")) {
        return Response.json({ access_token: "token-should-not-leak", expires_in: 3600 });
      }
      if (url.includes("/listings")) {
        return Response.json({ result: [{ id: 11, name: "Peaceful Pearl", city: "Ocean Springs", bedroomsNumber: 4 }] });
      }
      if (url.includes("/reservations")) {
        return Response.json({
          result: [
            {
              id: 1,
              listingMapId: 11,
              guestFirstName: "Camille",
              guestLastName: "Duval",
              guestEmail: "camille@example.com",
              phone: "+15551212",
              totalPrice: 2400,
              arrivalDate: "2026-11-03",
              departureDate: "2026-11-08",
              status: "new",
              channelName: "airbnb",
            },
            {
              id: 2,
              listingMapId: 11,
              guestFirstName: "Cancel",
              guestLastName: "Me",
              arrivalDate: "2026-11-10",
              departureDate: "2026-11-12",
              status: "cancelled",
            },
            {
              id: 3,
              listingMapId: 11,
              guestFirstName: "Ask",
              guestLastName: "Er",
              arrivalDate: "2026-11-12",
              departureDate: "2026-11-14",
              status: "inquiry",
            },
          ],
        });
      }
      throw new Error(url);
    });

    const first = await loadLiveCalendar("2026-11-01", "2027-05-01");
    const second = await loadLiveCalendar("2026-11-01", "2027-05-01");
    expect(second.stays).toEqual(first.stays);
    expect(calls.filter((call) => call.includes("/accessTokens"))).toHaveLength(1);
    expect(calls.some((call) => call.includes("grant_type=client_credentials") && call.includes("client_id=acct"))).toBe(true);
    expect(calls.some((call) => call.includes("/reservations") && call.includes("arrivalStartDate=") && call.includes("arrivalEndDate=") && !call.includes("listingId="))).toBe(true);
    expect(first.units.map((unit) => unit.id)).toEqual(["11"]);
    expect(first.stays.map((stay) => stay.guest)).toEqual(["Camille D."]);
    const serialized = JSON.stringify(first);
    for (const secret of ["camille@example.com", "5551212", "2400", "Duval", "token-should-not-leak", "secret-key", "Cancel", "Ask"]) {
      expect(serialized).not.toContain(secret);
    }
  });
  it("retries a 429 and pages remaining reservations in parallel using count", async () => {
    process.env.HOSTAWAY_ACCOUNT_ID = "acct";
    process.env.HOSTAWAY_API_KEY = "secret-key";
    const calls: string[] = [];
    let reservation429s = 0;
    setHostawayFetchForTests(async (input, init) => {
      const url = String(input);
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.endsWith("/accessTokens")) {
        return Response.json({ access_token: "token-should-not-leak", expires_in: 3600 });
      }
      if (url.includes("/listings")) {
        return Response.json({
          result: [{ id: 11, name: "Peaceful Pearl", city: "Ocean Springs", bedroomsNumber: 4 }],
          count: 1,
        });
      }
      if (url.includes("/reservations")) {
        const offset = Number(new URL(url).searchParams.get("offset") ?? "0");
        if (offset === 0 && reservation429s < 1) {
          reservation429s += 1;
          return new Response("rate limited", { status: 429, headers: { "Retry-After": "0" } });
        }
        const result = Array.from({ length: offset === 1000 ? 200 : 500 }, (_, index) => ({
          id: offset + index + 1,
          listingMapId: 11,
          guestFirstName: "Camille",
          guestLastName: "Duval",
          arrivalDate: "2026-11-03",
          departureDate: "2026-11-08",
          status: "new",
          channelName: "airbnb",
        }));
        return Response.json({ result, count: 1200, limit: 500, offset });
      }
      throw new Error(url);
    });

    const loaded = await loadLiveCalendar("2026-11-01", "2027-05-01");
    const reservationCalls = calls.filter((call) => call.includes("/reservations"));
    expect(reservation429s).toBe(1);
    expect(reservationCalls.some((call) => call.includes("offset=0"))).toBe(true);
    expect(reservationCalls.some((call) => call.includes("offset=500"))).toBe(true);
    expect(reservationCalls.some((call) => call.includes("offset=1000"))).toBe(true);
    expect(loaded.stays).toHaveLength(1200);
    expect(loaded.warning).toBeUndefined();
    expect(JSON.stringify(loaded)).not.toContain("Duval");
  });

  it("returns partial bookings when a later page fails and does not cache that result", async () => {
    process.env.HOSTAWAY_ACCOUNT_ID = "acct";
    process.env.HOSTAWAY_API_KEY = "secret-key";
    let reservationLoads = 0;
    setHostawayFetchForTests(async (input) => {
      const url = String(input);
      if (url.endsWith("/accessTokens")) {
        return Response.json({ access_token: "token-should-not-leak", expires_in: 3600 });
      }
      if (url.includes("/listings")) {
        return Response.json({
          result: [{ id: 11, name: "Peaceful Pearl", city: "Ocean Springs", bedroomsNumber: 4 }],
          count: 1,
        });
      }
      if (url.includes("/reservations")) {
        const offset = Number(new URL(url).searchParams.get("offset") ?? "0");
        if (offset === 0) {
          reservationLoads += 1;
          const result = Array.from({ length: 500 }, (_, index) => ({
            id: index + 1,
            listingMapId: 11,
            guestFirstName: "Camille",
            guestLastName: "Duval",
            arrivalDate: "2026-11-03",
            departureDate: "2026-11-08",
            status: "new",
            channelName: "airbnb",
          }));
          return Response.json({ result, count: 700, limit: 500, offset: 0 });
        }
        if (reservationLoads === 1) {
          return new Response("upstream error", { status: 500, headers: { "Retry-After": "0" } });
        }
        const result = Array.from({ length: 200 }, (_, index) => ({
          id: 500 + index + 1,
          listingMapId: 11,
          guestFirstName: "Camille",
          guestLastName: "Duval",
          arrivalDate: "2026-11-10",
          departureDate: "2026-11-12",
          status: "new",
          channelName: "airbnb",
        }));
        return Response.json({ result, count: 700, limit: 500, offset });
      }
      throw new Error(url);
    });

    const first = await loadLiveCalendar("2026-11-01", "2027-05-01");
    expect(first.stays).toHaveLength(500);
    expect(first.warning).toMatch(/Some bookings could not be loaded/i);

    const second = await loadLiveCalendar("2026-11-01", "2027-05-01");
    expect(second.stays).toHaveLength(700);
    expect(second.warning).toBeUndefined();
  });

  it("refetches listings and reservations after the calendar cache expires", async () => {
    process.env.HOSTAWAY_ACCOUNT_ID = "acct";
    process.env.HOSTAWAY_API_KEY = "secret-key";
    let generation = 0;
    const calls: string[] = [];
    setHostawayFetchForTests(async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/accessTokens")) return Response.json({ access_token: "token-1" });
      if (url.includes("/listings")) {
        const result = [
          { id: 484247, name: "Porter House", city: "Ocean Springs", bedroomsNumber: 3 },
        ];
        if (generation > 0) {
          result.push({ id: 634553, name: "450 Porter Ave B", city: "Ocean Springs", bedroomsNumber: 2 });
        }
        return Response.json({ result, count: result.length });
      }
      if (url.includes("/reservations")) {
        const offset = Number(new URL(url).searchParams.get("offset") ?? "0");
        if (offset > 0) return Response.json({ result: [], count: 1, offset });
        const result: Array<Record<string, unknown>> = [
          {
            id: 1,
            listingMapId: 484247,
            guestFirstName: "Camille",
            guestLastName: "Duval",
            arrivalDate: "2026-11-03",
            departureDate: "2026-11-08",
            status: generation === 0 ? "new" : "cancelled",
            channelName: "airbnb",
          },
        ];
        if (generation > 0) {
          result.push({
            id: 72011656,
            listingMapId: 484247,
            guestFirstName: "Dana",
            guestLastName: "Anderson",
            guestEmail: "dana@example.com",
            arrivalDate: "2026-11-20",
            departureDate: "2026-11-23",
            status: "new",
            channelName: "airbnb",
          });
        }
        return Response.json({ result, count: result.length });
      }
      throw new Error(url);
    });

    const first = await loadLiveCalendar("2026-11-01", "2027-05-01");
    expect(first.units.map((unit) => unit.id)).toEqual(["484247"]);
    expect(first.stays.map((stay) => stay.guest)).toEqual(["Camille D."]);
    const callsAfterFirst = calls.length;
    const cached = await loadLiveCalendar("2026-11-01", "2027-05-01");
    expect(cached).toEqual(first);
    expect(calls).toHaveLength(callsAfterFirst);

    generation = 1;
    setTimedCacheForTests("hostaway-calendar:2026-11-01:2027-05-01", first, Date.now() - 1000);
    const refreshed = await loadLiveCalendar("2026-11-01", "2027-05-01");
    expect(refreshed.units.map((unit) => unit.id)).toEqual(["484247", "634553"]);
    expect(refreshed.stays.map((stay) => stay.id)).toEqual(["hostaway-72011656"]);
    expect(refreshed.stays.map((stay) => stay.guest)).toEqual(["Dana A."]);
    expect(calls.length).toBeGreaterThan(callsAfterFirst);
    const serialized = JSON.stringify(refreshed);
    for (const secret of ["Anderson", "dana@example.com", "Duval", "Camille"]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("requests a new Hostaway token when the cached token has expired", async () => {
    process.env.HOSTAWAY_ACCOUNT_ID = "acct";
    process.env.HOSTAWAY_API_KEY = "secret-key";
    let tokenWrites = 0;
    const authorizations: string[] = [];
    setHostawayFetchForTests(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/accessTokens")) {
        tokenWrites += 1;
        return Response.json({ access_token: `token-${tokenWrites}` });
      }
      authorizations.push(new Headers(init?.headers).get("authorization") ?? "");
      if (url.includes("/listings")) {
        return Response.json({
          result: [{ id: 11, name: "Peaceful Pearl", city: "Ocean Springs", bedroomsNumber: 4 }],
          count: 1,
        });
      }
      if (url.includes("/reservations")) {
        const offset = Number(new URL(url).searchParams.get("offset") ?? "0");
        if (offset > 0) return Response.json({ result: [], count: 1, offset });
        return Response.json({
          result: [
            {
              id: 1,
              listingMapId: 11,
              guestFirstName: "Camille",
              guestLastName: "Duval",
              arrivalDate: "2026-11-03",
              departureDate: "2026-11-08",
              status: "new",
              channelName: "airbnb",
            },
          ],
          count: 1,
        });
      }
      throw new Error(url);
    });

    await loadLiveCalendar("2026-11-01", "2027-05-01");
    setTimedCacheForTests("hostaway-token", "token-1", Date.now() - 1000);
    setTimedCacheForTests(
      "hostaway-calendar:2026-11-01:2027-05-01",
      { stays: [], units: [{ id: "11", name: "Peaceful Pearl", town: "Ocean Springs", bedrooms: 4 }] },
      Date.now() - 1000,
    );
    const refreshed = await loadLiveCalendar("2026-11-01", "2027-05-01");
    expect(refreshed.stays.map((stay) => stay.guest)).toEqual(["Camille D."]);
    expect(tokenWrites).toBe(2);
    expect(authorizations).toContain("Bearer token-2");
  });

  it("uses the previous token when a refresh cannot reach Hostaway", async () => {
    process.env.HOSTAWAY_ACCOUNT_ID = "acct";
    process.env.HOSTAWAY_API_KEY = "secret-key";
    let tokenRequests = 0;
    const authorizations: string[] = [];
    setHostawayFetchForTests(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/accessTokens")) {
        tokenRequests += 1;
        if (tokenRequests > 1) return new Response("unavailable", { status: 500, headers: { "retry-after": "0" } });
        return Response.json({ access_token: "token-1" });
      }
      authorizations.push(new Headers(init?.headers).get("authorization") ?? "");
      if (url.includes("/listings")) {
        return Response.json({
          result: [{ id: 11, name: "Peaceful Pearl", city: "Ocean Springs", bedroomsNumber: 4 }],
          count: 1,
        });
      }
      if (url.includes("/reservations")) {
        const offset = Number(new URL(url).searchParams.get("offset") ?? "0");
        if (offset > 0) return Response.json({ result: [], count: 1, offset });
        return Response.json({
          result: [
            {
              id: 9,
              listingMapId: 11,
              guestFirstName: "Dana",
              guestLastName: "Anderson",
              arrivalDate: "2026-11-20",
              departureDate: "2026-11-23",
              status: "new",
              channelName: "airbnb",
            },
          ],
          count: 1,
        });
      }
      throw new Error(url);
    });

    await loadLiveCalendar("2026-11-01", "2027-05-01");
    setTimedCacheForTests("hostaway-token", "token-1", Date.now() - 1000);
    setTimedCacheForTests("hostaway-calendar:2026-11-01:2027-05-01", { stays: [], units: [] }, Date.now() - 1000);
    const refreshed = await loadLiveCalendar("2026-11-01", "2027-05-01");
    expect(refreshed.stays.map((stay) => stay.guest)).toEqual(["Dana A."]);
    expect(authorizations.every((header) => header === "Bearer token-1")).toBe(true);
    expect(JSON.stringify(refreshed)).not.toContain("Anderson");
  });

  it("replaces a rejected Hostaway token and retries the calendar fetch once", async () => {
    process.env.HOSTAWAY_ACCOUNT_ID = "acct";
    process.env.HOSTAWAY_API_KEY = "secret-key";
    let tokenWrites = 0;
    let listingCalls = 0;
    const authorizations: string[] = [];
    setHostawayFetchForTests(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/accessTokens")) {
        tokenWrites += 1;
        return Response.json({ access_token: `token-${tokenWrites}` });
      }
      const authorization = new Headers(init?.headers).get("authorization") ?? "";
      authorizations.push(authorization);
      if (url.includes("/listings")) {
        listingCalls += 1;
        if (authorization === "Bearer token-1") return new Response("denied", { status: 401 });
        return Response.json({
          result: [{ id: 634553, name: "450 Porter Ave B", city: "Ocean Springs", bedroomsNumber: 2 }],
          count: 1,
        });
      }
      if (url.includes("/reservations")) {
        const offset = Number(new URL(url).searchParams.get("offset") ?? "0");
        if (offset > 0) return Response.json({ result: [], count: 1, offset });
        return Response.json({
          result: [
            {
              id: 72011656,
              listingMapId: 634553,
              guestFirstName: "Dana",
              guestLastName: "Anderson",
              arrivalDate: "2026-11-20",
              departureDate: "2026-11-23",
              status: "new",
              channelName: "airbnb",
            },
          ],
          count: 1,
        });
      }
      throw new Error(url);
    });

    const loaded = await loadLiveCalendar("2026-11-01", "2027-05-01");
    expect(loaded.units.map((unit) => unit.id)).toEqual(["634553"]);
    expect(loaded.stays.map((stay) => stay.guest)).toEqual(["Dana A."]);
    expect(tokenWrites).toBe(2);
    expect(listingCalls).toBe(2);
    expect(authorizations).toContain("Bearer token-1");
    expect(authorizations).toContain("Bearer token-2");
    expect(JSON.stringify(loaded)).not.toContain("Anderson");
  });

  it("does not retry the calendar with a rejected token when the refresh fails", async () => {
    process.env.HOSTAWAY_ACCOUNT_ID = "acct";
    process.env.HOSTAWAY_API_KEY = "secret-key";
    let tokenRequests = 0;
    let listingCalls = 0;
    setHostawayFetchForTests(async (input) => {
      const url = String(input);
      if (url.endsWith("/accessTokens")) {
        tokenRequests += 1;
        if (tokenRequests === 1) return Response.json({ access_token: "token-1" });
        return new Response("unavailable", { status: 500, headers: { "retry-after": "0" } });
      }
      if (url.includes("/listings")) {
        listingCalls += 1;
        return new Response("denied", { status: 401 });
      }
      if (url.includes("/reservations")) return Response.json({ result: [], count: 0 });
      throw new Error(url);
    });

    await expect(loadLiveCalendar("2026-11-01", "2027-05-01")).rejects.toThrow(/access token|Hostaway/i);
    expect(listingCalls).toBe(1);
  });

});

describe("snapshot cache", () => {
  afterEach(() => {
    setHostawayFetchForTests(null);
    clearTimedCache();
    delete process.env.DATA_MODE;
    delete process.env.HOSTAWAY_ACCOUNT_ID;
    delete process.env.HOSTAWAY_API_KEY;
  });

  it("returns a live cache miss without calling Hostaway", async () => {
    process.env.DATA_MODE = "live";
    process.env.HOSTAWAY_ACCOUNT_ID = "acct";
    process.env.HOSTAWAY_API_KEY = "secret-key";
    const calls: string[] = [];
    setHostawayFetchForTests(async (input) => {
      calls.push(String(input));
      throw new Error("Hostaway should not be called on a cache peek");
    });
    await expect(readCachedSnapshot(new Date("2026-11-05T18:00:00Z"))).resolves.toBeNull();
    expect(calls).toEqual([]);
  });

  it("warms the snapshot once and serves later reads from cache", async () => {
    process.env.DATA_MODE = "live";
    process.env.HOSTAWAY_ACCOUNT_ID = "acct";
    process.env.HOSTAWAY_API_KEY = "secret-key";
    const calls: string[] = [];
    setHostawayFetchForTests(async (input, init) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/accessTokens")) {
        return Response.json({ access_token: "token-should-not-leak", expires_in: 3600 });
      }
      if (url.includes("/listings")) {
        return Response.json({
          result: [{ id: 11, name: "Peaceful Pearl", city: "Ocean Springs", bedroomsNumber: 4 }],
          count: 1,
        });
      }
      if (url.includes("/reservations")) {
        const offset = Number(new URL(url).searchParams.get("offset") ?? "0");
        if (offset > 0) return Response.json({ result: [], count: 1, offset });
        return Response.json({
          result: [
            {
              id: 1,
              listingMapId: 11,
              guestFirstName: "Camille",
              guestLastName: "Duval",
              arrivalDate: "2026-11-03",
              departureDate: "2026-11-08",
              status: "new",
              channelName: "airbnb",
            },
          ],
          count: 1,
        });
      }
      throw new Error(url);
    });
    const now = new Date("2026-11-05T18:00:00Z");
    const warmed = await warmSnapshot(now);
    const cached = await readCachedSnapshot(now);
    expect(cached?.stale).toBe(false);
    expect(cached?.snapshot.stays.map((stay) => stay.guest)).toEqual(["Camille D."]);
    expect(cached?.snapshot.units?.map((unit) => unit.id)).toEqual(warmed.units?.map((unit) => unit.id));
    const hostawayCalls = calls.length;
    const again = await readCachedSnapshot(now);
    expect(again?.snapshot).toEqual(cached?.snapshot);
    expect(calls).toHaveLength(hostawayCalls);
    expect(snapshotCacheKey(now)).toBe("snapshot:2026-11-01:2027-05-01");
  });

  it("keeps serving an expired snapshot without calling Hostaway", async () => {
    process.env.DATA_MODE = "live";
    process.env.HOSTAWAY_ACCOUNT_ID = "acct";
    process.env.HOSTAWAY_API_KEY = "secret-key";
    const calls: string[] = [];
    setHostawayFetchForTests(async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/accessTokens")) {
        return Response.json({ access_token: "token-should-not-leak", expires_in: 3600 });
      }
      if (url.includes("/listings")) {
        return Response.json({
          result: [{ id: 11, name: "Peaceful Pearl", city: "Ocean Springs", bedroomsNumber: 4 }],
          count: 1,
        });
      }
      if (url.includes("/reservations")) {
        const offset = Number(new URL(url).searchParams.get("offset") ?? "0");
        if (offset > 0) return Response.json({ result: [], count: 1, offset });
        return Response.json({
          result: [
            {
              id: 1,
              listingMapId: 11,
              guestFirstName: "Camille",
              guestLastName: "Duval",
              arrivalDate: "2026-11-03",
              departureDate: "2026-11-08",
              status: "new",
              channelName: "airbnb",
            },
          ],
          count: 1,
        });
      }
      throw new Error(url);
    });
    const now = new Date("2026-11-05T18:00:00Z");
    const warmed = await warmSnapshot(now);
    const before = calls.length;
    setTimedCacheForTests(snapshotCacheKey(now), warmed, Date.now() - 1000);
    const stale = await readCachedSnapshot(now);
    expect(stale?.stale).toBe(true);
    expect(stale?.snapshot.stays.map((stay) => stay.guest)).toEqual(["Camille D."]);
    expect(calls).toHaveLength(before);
  });

  it("forced warm refetches an expired Hostaway calendar and replaces the snapshot", async () => {
    process.env.DATA_MODE = "live";
    process.env.HOSTAWAY_ACCOUNT_ID = "acct";
    process.env.HOSTAWAY_API_KEY = "secret-key";
    let generation = 0;
    const calls: string[] = [];
    setHostawayFetchForTests(async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/accessTokens")) return Response.json({ access_token: "token-1" });
      if (url.includes("/listings")) {
        const result = [{ id: 484247, name: "Porter House", city: "Ocean Springs", bedroomsNumber: 3 }];
        if (generation > 0) {
          result.push({ id: 634553, name: "450 Porter Ave B", city: "Ocean Springs", bedroomsNumber: 2 });
        }
        return Response.json({ result, count: result.length });
      }
      if (url.includes("/reservations")) {
        const offset = Number(new URL(url).searchParams.get("offset") ?? "0");
        if (offset > 0) return Response.json({ result: [], count: generation === 0 ? 1 : 2, offset });
        const result = [
          {
            id: 1,
            listingMapId: 484247,
            guestFirstName: "Camille",
            guestLastName: "Duval",
            arrivalDate: "2026-11-03",
            departureDate: "2026-11-08",
            status: generation === 0 ? "new" : "cancelled",
            channelName: "airbnb",
          },
        ];
        if (generation > 0) {
          result.push({
            id: 72011656,
            listingMapId: 484247,
            guestFirstName: "Dana",
            guestLastName: "Anderson",
            arrivalDate: "2026-11-20",
            departureDate: "2026-11-23",
            status: "new",
            channelName: "airbnb",
          });
        }
        return Response.json({ result, count: result.length });
      }
      throw new Error(url);
    });

    const now = new Date("2026-11-05T18:00:00Z");
    const warmed = await warmSnapshot(now, { force: true });
    expect(warmed.stays.map((stay) => stay.guest)).toEqual(["Camille D."]);
    const callsAfterFresh = calls.length;
    const repeated = await warmSnapshot(now, { force: true });
    expect(repeated.stays.map((stay) => stay.guest)).toEqual(["Camille D."]);
    expect(calls).toHaveLength(callsAfterFresh);

    generation = 1;
    setTimedCacheForTests(
      "hostaway-calendar:2026-11-01:2027-05-01",
      { stays: warmed.stays, units: warmed.units },
      Date.now() - 1000,
    );
    const later = new Date("2026-11-05T18:10:00Z");
    const refreshed = await warmSnapshot(later, { force: true });
    expect(refreshed.fetchedAt).toBe(later.toISOString());
    expect(refreshed.units?.map((unit) => unit.id)).toEqual(["484247", "634553"]);
    expect(refreshed.stays.map((stay) => stay.id)).toEqual(["hostaway-72011656"]);
    expect(refreshed.stays.map((stay) => stay.guest)).toEqual(["Dana A."]);
    const stored = await readCachedSnapshot(later);
    expect(stored?.stale).toBe(false);
    expect(stored?.snapshot.stays.map((stay) => stay.guest)).toEqual(["Dana A."]);
    expect(stored?.snapshot.fetchedAt).toBe(later.toISOString());
    expect(JSON.stringify(stored?.snapshot)).not.toContain("Anderson");
  });

  it("keeps the last snapshot when a forced warm cannot reach Hostaway", async () => {
    process.env.DATA_MODE = "live";
    process.env.HOSTAWAY_ACCOUNT_ID = "acct";
    process.env.HOSTAWAY_API_KEY = "secret-key";
    const calls: string[] = [];
    setHostawayFetchForTests(async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/accessTokens")) return Response.json({ access_token: "token-1" });
      if (url.includes("/listings")) {
        return Response.json({
          result: [{ id: 11, name: "Peaceful Pearl", city: "Ocean Springs", bedroomsNumber: 4 }],
          count: 1,
        });
      }
      if (url.includes("/reservations")) {
        const offset = Number(new URL(url).searchParams.get("offset") ?? "0");
        if (offset > 0) return Response.json({ result: [], count: 1, offset });
        return Response.json({
          result: [
            {
              id: 1,
              listingMapId: 11,
              guestFirstName: "Camille",
              guestLastName: "Duval",
              arrivalDate: "2026-11-03",
              departureDate: "2026-11-08",
              status: "new",
              channelName: "airbnb",
            },
          ],
          count: 1,
        });
      }
      throw new Error(url);
    });

    const now = new Date("2026-11-05T18:00:00Z");
    const warmed = await warmSnapshot(now);
    setHostawayFetchForTests(async () => new Response("down", { status: 400 }));
    setTimedCacheForTests(snapshotCacheKey(now), warmed, Date.now() + 60_000);
    setTimedCacheForTests(
      "hostaway-calendar:2026-11-01:2027-05-01",
      { stays: warmed.stays, units: warmed.units },
      Date.now() - 1000,
    );
    await expect(warmSnapshot(now, { force: true })).rejects.toThrow(/access token|Hostaway/i);
    const callsAfterFailure = calls.length;
    const cached = await readCachedSnapshot(now);
    expect(cached?.snapshot.fetchedAt).toBe(warmed.fetchedAt);
    expect(cached?.snapshot.stays.map((stay) => stay.guest)).toEqual(["Camille D."]);
    expect(cached?.snapshot.units?.map((unit) => unit.id)).toEqual(["11"]);
    expect(calls).toHaveLength(callsAfterFailure);
  });
});

describe("timed cache", () => {
  afterEach(() => {
    clearTimedCache();
  });

  it("refetches an expired entry instead of serving it forever", async () => {
    let loads = 0;
    const load = async () => {
      loads += 1;
      return `value-${loads}`;
    };
    expect(await remember("sample", 1000, load)).toBe("value-1");
    expect(await remember("sample", 1000, load)).toBe("value-1");
    setTimedCacheForTests("sample", "value-1", Date.now() - 1);
    expect(await remember("sample", 1000, load)).toBe("value-2");
    setTimedCacheForTests("sample", "value-2", Date.now() - 1);
    expect(await remember("sample", 1000, load, { allowStale: true })).toBe("value-2");
    expect(loads).toBe(2);
  });
});

describe("timeout helper", () => {
  it("rejects a hanging promise", async () => {
    await expect(withTimeout(new Promise(() => undefined), 20, "Blob read timed out")).rejects.toThrow(
      "Blob read timed out",
    );
  });
});

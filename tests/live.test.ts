import { afterEach, describe, expect, it } from "vitest";
import { authenticate } from "@/lib/authenticate";
import { buildPortalView } from "@/lib/view";
import { clearTimedCache } from "@/lib/timed-cache";
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

});

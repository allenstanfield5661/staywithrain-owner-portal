import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authenticate } from "@/lib/authenticate";
import { duplicateOwnerEmailMessage } from "@/lib/owner-rules";
import {
  liveAssignmentMap,
  loadOwners,
  mergeOwnerDrafts,
  parseOwnersConfig,
  resetTestOwners,
  saveOwners,
  useTestOwners,
  type StoredOwner,
} from "@/lib/owner-store";
import { hashPassword } from "@/lib/passwords";
import type { Snapshot } from "@/lib/snapshot";
import type { Unit } from "@/lib/catalog";
import { buildPortalView, unitsVisibleTo } from "@/lib/view";

const NOW = new Date("2026-11-05T18:00:00Z");

const houses: Unit[] = [
  { id: "1", name: "703 Madison", town: "Ocean Springs", bedrooms: 3, hostawayListingId: 1 },
  { id: "2", name: "Downtown Canopy", town: "Ocean Springs", bedrooms: 2, hostawayListingId: 2 },
  { id: "3", name: "Palm & Pearl", town: "Ocean Springs", bedrooms: 3, hostawayListingId: 3 },
  { id: "blue-crest", name: "Blue Crest", town: "Ocean Springs", bedrooms: 4, hostawayListingId: 40 },
];

function owner(partial: StoredOwner): StoredOwner {
  return partial;
}

function snapshot(): Snapshot {
  return {
    fetchedAt: NOW.toISOString(),
    source: "live",
    cartSource: "unconfigured",
    matchedUnitIds: houses.map((unit) => unit.id),
    units: houses,
    stays: houses.map((unit) => ({
      id: `stay-${unit.id}`,
      unitId: unit.id,
      guest: `Guest ${unit.name}`,
      arrival: "2026-11-03",
      departure: "2026-11-08",
      nights: 5,
      channel: "Airbnb",
      tone: "guest" as const,
      statusLabel: "Confirmed",
    })),
    carts: [],
    unmatchedCarts: 0,
  };
}

describe("co-owner logins", () => {
  beforeEach(() => {
    process.env.DATA_MODE = "live";
    useTestOwners([]);
  });

  afterEach(() => {
    resetTestOwners();
    delete process.env.DATA_MODE;
  });

  it("keeps one login when two names share a single email", async () => {
    const swaffordHash = await hashPassword("swafford-coast-1");
    const faganHash = await hashPassword("fagan-coast-22");
    await saveOwners([
      owner({
        id: "swafford",
        name: "Keith & Jeanna Swafford",
        email: " Home@Example.com ",
        passwordHash: swaffordHash,
        listingIds: ["blue-crest", "blue-crest"],
      }),
      owner({
        id: "fagan",
        name: "Lori & David Fagan",
        email: "fagan@example.com",
        passwordHash: faganHash,
        listingIds: ["slip-away"],
      }),
    ]);

    const saved = await loadOwners();
    expect(saved.map((item) => [item.id, item.name, item.email, item.listingIds])).toEqual([
      ["swafford", "Keith & Jeanna Swafford", "home@example.com", ["blue-crest"]],
      ["fagan", "Lori & David Fagan", "fagan@example.com", ["slip-away"]],
    ]);
    expect(saved[0]?.passwordHash).toBe(swaffordHash);
    expect(saved[1]?.passwordHash).toBe(faganHash);
    expect((await authenticate("home@example.com", "swafford-coast-1"))?.id).toBe("swafford");
    expect((await authenticate("fagan@example.com", "fagan-coast-22"))?.id).toBe("fagan");
    expect(await authenticate("home@example.com", "fagan-coast-22")).toBeNull();

    await expect(
      saveOwners([
        owner({
          id: "keith",
          name: "Keith Swafford",
          email: "home@example.com",
          passwordHash: swaffordHash,
          listingIds: ["blue-crest"],
        }),
        owner({
          id: "jeanna",
          name: "Jeanna Swafford",
          email: " HOME@example.com ",
          passwordHash: "different-hash",
          listingIds: ["blue-crest"],
        }),
      ]),
    ).rejects.toThrow(duplicateOwnerEmailMessage("home@example.com"));

    const kept = await loadOwners();
    expect(kept.map((item) => item.id)).toEqual(["swafford", "fagan"]);
    expect(() =>
      mergeOwnerDrafts(kept, [
        { id: "swafford", name: "Keith & Jeanna Swafford", email: "home@example.com", listingIds: ["blue-crest"] },
        { id: "owner-new-jeanna", name: "Jeanna Swafford", email: "home@example.com", listingIds: ["blue-crest"] },
      ]),
    ).toThrow(duplicateOwnerEmailMessage("home@example.com"));
  });

  it("lets two co-owners share one listing with separate emails and passwords", async () => {
    const adaHash = await hashPassword("ada-coastal-key");
    const benHash = await hashPassword("ben-coastal-key");
    await saveOwners([
      owner({
        id: "ada",
        name: "Ada Shore",
        email: "Ada@Shore.example",
        passwordHash: adaHash,
        listingIds: ["blue-crest"],
      }),
      owner({
        id: "ben",
        name: "Ben Shore",
        email: "ben@shore.example",
        passwordHash: benHash,
        listingIds: ["blue-crest"],
      }),
    ]);

    const saved = await loadOwners();
    expect(saved.map((item) => item.listingIds)).toEqual([["blue-crest"], ["blue-crest"]]);
    expect(saved.map((item) => item.passwordHash)).toEqual([adaHash, benHash]);
    expect((await authenticate("ada@shore.example", "ada-coastal-key"))?.id).toBe("ada");
    expect((await authenticate("ben@shore.example", "ben-coastal-key"))?.id).toBe("ben");
    expect(await authenticate("ada@shore.example", "ben-coastal-key")).toBeNull();
    expect(await authenticate("ben@shore.example", "ada-coastal-key")).toBeNull();

    const assignments = await liveAssignmentMap();
    expect(assignments["blue-crest"]).toEqual(["ada", "ben"]);
    const adaView = buildPortalView({
      account: { id: "ada", name: "Ada Shore", email: "ada@shore.example", role: "owner" },
      units: houses,
      assignments,
      snapshot: snapshot(),
      unit: "blue-crest",
      now: NOW,
    });
    const benView = buildPortalView({
      account: { id: "ben", name: "Ben Shore", email: "ben@shore.example", role: "owner" },
      units: houses,
      assignments,
      snapshot: snapshot(),
      unit: "blue-crest",
      now: NOW,
    });
    expect(adaView.units.map((unit) => unit.id)).toEqual(["blue-crest"]);
    expect(benView.units.map((unit) => unit.id)).toEqual(["blue-crest"]);
    expect(adaView.selected?.name).toBe("Blue Crest");
    expect(benView.calendarStays.map((stay) => stay.id)).toEqual(["stay-blue-crest"]);
    expect(JSON.stringify(adaView)).not.toContain("stay-1");
  });

  it("keeps a partial listing overlap and hides the listing a co-owner does not have", async () => {
    const davidHash = await hashPassword("david-boland-key");
    const bonnieHash = await hashPassword("bonnie-boland-key");
    const shelleyHash = await hashPassword("shelley-boland-key");
    await saveOwners([
      owner({
        id: "david",
        name: "David Boland",
        email: "david@boland.example",
        passwordHash: davidHash,
        listingIds: ["1", "2", "3"],
      }),
      owner({
        id: "bonnie",
        name: "Bonnie Boland",
        email: "bonnie@boland.example",
        passwordHash: bonnieHash,
        listingIds: ["1", "2", "3"],
      }),
      owner({
        id: "shelley",
        name: "Shelley Boland",
        email: "shelley@boland.example",
        passwordHash: shelleyHash,
        listingIds: ["2", "3"],
      }),
    ]);

    expect((await loadOwners()).map((item) => [item.id, item.listingIds, item.passwordHash])).toEqual([
      ["david", ["1", "2", "3"], davidHash],
      ["bonnie", ["1", "2", "3"], bonnieHash],
      ["shelley", ["2", "3"], shelleyHash],
    ]);
    expect(await liveAssignmentMap()).toEqual({
      "1": ["david", "bonnie"],
      "2": ["david", "bonnie", "shelley"],
      "3": ["david", "bonnie", "shelley"],
    });

    const assignments = await liveAssignmentMap();
    const viewFor = (id: string, name: string, email: string, unit?: string) =>
      buildPortalView({
        account: { id, name, email, role: "owner" },
        units: houses,
        assignments,
        snapshot: snapshot(),
        unit,
        now: NOW,
      });

    expect(viewFor("david", "David Boland", "david@boland.example").units.map((unit) => unit.id)).toEqual(["1", "2", "3"]);
    expect(viewFor("bonnie", "Bonnie Boland", "bonnie@boland.example").units.map((unit) => unit.id)).toEqual(["1", "2", "3"]);
    const shelley = viewFor("shelley", "Shelley Boland", "shelley@boland.example", "1");
    expect(shelley.units.map((unit) => unit.id)).toEqual(["2", "3"]);
    expect(shelley.selected?.id).toBe("2");
    expect(JSON.stringify(shelley)).not.toContain("stay-1");
    expect(JSON.stringify(shelley)).not.toContain("703 Madison");
    expect((await authenticate("david@boland.example", "david-boland-key"))?.name).toBe("David Boland");
    expect((await authenticate("bonnie@boland.example", "bonnie-boland-key"))?.id).toBe("bonnie");
    expect((await authenticate("shelley@boland.example", "shelley-boland-key"))?.id).toBe("shelley");
    expect(await authenticate("shelley@boland.example", "david-boland-key")).toBeNull();
  });

  it("preserves each password hash when owner details are saved again", async () => {
    const davidHash = await hashPassword("david-boland-key");
    const bonnieHash = await hashPassword("bonnie-boland-key");
    await saveOwners([
      owner({
        id: "david",
        name: "David Boland",
        email: "david@boland.example",
        passwordHash: davidHash,
        listingIds: ["1"],
      }),
      owner({
        id: "bonnie",
        name: "Bonnie Boland",
        email: "bonnie@boland.example",
        passwordHash: bonnieHash,
        listingIds: ["1"],
      }),
    ]);

    const merged = mergeOwnerDrafts(await loadOwners(), [
      { id: "david", name: "David Boland", email: "David@Boland.example", listingIds: ["1", "2", "3"] },
      { id: "bonnie", name: "Bonnie Boland", email: "bonnie@boland.example", listingIds: ["1", "2", "3"] },
    ]);
    expect(merged.map((item) => item.passwordHash)).toEqual([davidHash, bonnieHash]);
    await saveOwners(merged);
    const saved = await loadOwners();
    expect(saved.map((item) => [item.email, item.listingIds, item.passwordHash])).toEqual([
      ["david@boland.example", ["1", "2", "3"], davidHash],
      ["bonnie@boland.example", ["1", "2", "3"], bonnieHash],
    ]);

    const readded = mergeOwnerDrafts(saved, [
      { id: "owner-new-david", name: "David Boland", email: "david@boland.example", listingIds: ["1", "2"] },
    ]);
    expect(readded).toEqual([
      {
        id: "david",
        name: "David Boland",
        email: "david@boland.example",
        passwordHash: davidHash,
        listingIds: ["1", "2"],
      },
    ]);
  });

  it("still honors a single-owner assignment string", () => {
    const visible = unitsVisibleTo(
      { id: "david", name: "David Boland", email: "david@boland.example", role: "owner" },
      houses,
      { "1": "david", "2": ["bonnie"], "3": ["david", "bonnie"] },
    );
    expect(visible.map((unit) => unit.id)).toEqual(["1", "3"]);
  });

  it("reads a shared-listing OWNERS_JSON seed without collapsing logins", () => {
    const parsed = parseOwnersConfig(
      JSON.stringify({
        owners: [
          {
            id: "swafford",
            name: "Keith & Jeanna Swafford",
            email: "Home@Example.com",
            passwordHash: "hash-home",
            listingIds: ["blue-crest"],
          },
          {
            id: "ada",
            name: "Ada Shore",
            email: "ada@shore.example",
            listingIds: ["blue-crest"],
          },
        ],
      }),
    );
    expect(parsed.map((item) => [item.email, item.passwordHash, item.listingIds])).toEqual([
      ["home@example.com", "hash-home", ["blue-crest"]],
      ["ada@shore.example", null, ["blue-crest"]],
    ]);
  });
});

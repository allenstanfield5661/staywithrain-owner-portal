import { describe, expect, it } from "vitest";
import { listTagMappings, listUnits, ownerAccounts, toPublicAccount, listAccounts } from "@/lib/catalog";
import { barsForWeek } from "@/lib/calendar-layout";
import { addDays, eachNight, reportingMonths, windowMonths } from "@/lib/dates";
import { matchListing, mapHostawayReservation } from "@/lib/hostaway";
import { matchTag, parseIcs } from "@/lib/ics";
import { buildMockIcs, buildMockStays, buildRawMockStays } from "@/lib/mock-source";
import { occupancyForMonth } from "@/lib/occupancy";
import { redactEventLabel, redactGuestName } from "@/lib/privacy";
import { passwordsMatch, readSessionToken, signSession } from "@/lib/session";
import { loadSnapshot } from "@/lib/snapshot";
import { isExcludedStatus, staysOverlap } from "@/lib/stays";
import { buildPortalView, unitsVisibleTo } from "@/lib/view";
import { seedAssignmentMap } from "@/lib/catalog";

const NOW = new Date("2026-11-05T18:00:00Z");

describe("privacy", () => {
  it("keeps only a first name and last initial", () => {
    expect(redactGuestName("Mary Jane", "Watson")).toBe("Mary W.");
    expect(redactGuestName(null, null, "Andrew Peterson")).toBe("Andrew P.");
    expect(redactGuestName("Greta", "Holm greta@example.com")).toBe("Greta H.");
    expect(redactGuestName(null, null, "Paloma Reyes 555-0199 paloma@example.com")).toBe("Paloma R.");
    expect(redactGuestName("", "", "")).toBe("Guest");
  });

  it("redacts cart titles and drops contact details", () => {
    expect(redactEventLabel("Golf cart (A) — Harper Lang", "(A)")).toBe("Harper L.");
    expect(redactEventLabel("Family weekend (Donald's)", "(Donald's)")).toBe("Family weekend");
    expect(redactEventLabel("(19) — Kenji Sato 555-0148", "(19)")).toBe("Kenji S.");
    expect(redactEventLabel("(A)", "(A)")).toBe("Cart rental");
  });

  it("does not put passwords on the public account", () => {
    for (const account of listAccounts()) {
      expect(toPublicAccount(account)).not.toHaveProperty("password");
    }
  });
});

describe("reservations", () => {
  it("drops cancelled, declined, inquiry, and expired statuses", () => {
    for (const status of ["cancelled", "canceled", "declined", "inquiry", "inquiryPreapproved", "inquiryDenied", "expired", ""]) {
      expect(isExcludedStatus(status)).toBe(true);
    }
    for (const status of ["new", "modified", "ownerStay", "pending", "awaitingPayment"]) {
      expect(isExcludedStatus(status)).toBe(false);
    }
  });

  it("maps a Hostaway reservation without payment, contact, notes, or door codes", () => {
    const stay = mapHostawayReservation(
      {
        id: 13,
        listingMapId: 40160,
        guestName: "Andrew Peterson",
        guestFirstName: "Andrew",
        guestLastName: "Peterson",
        guestEmail: "mail@test.com",
        phone: "+75125551212",
        arrivalDate: "2026-11-15",
        departureDate: "2026-11-18",
        status: "new",
        channelName: "airbnb",
        totalPrice: 267,
        hostNote: "secret note about the guest",
        guestNote: "call me",
        doorCode: "12345",
        airbnbExpectedPayoutAmount: 111.12,
      },
      "picture-book-cottage",
    );
    expect(stay?.guest).toBe("Andrew P.");
    expect(stay?.nights).toBe(3);
    expect(stay?.channel).toBe("Airbnb");
    const serialized = JSON.stringify(stay);
    for (const secret of ["mail@test.com", "7512", "secret note", "call me", "12345", "267", "111.12", "Peterson"]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("matches listings by id, then by name", () => {
    const listings = [
      { id: 10, name: "Something else" },
      { id: 19, name: "Porter Pulse #19" },
      { id: 4, name: "Marée Maison" },
    ];
    const pulse = listUnits().find((unit) => unit.id === "porter-pulse-19");
    const maree = listUnits().find((unit) => unit.id === "maree-maison");
    expect(pulse && matchListing(pulse, listings)?.id).toBe(19);
    expect(maree && matchListing({ ...maree, hostawayListingId: 10 }, listings)?.id).toBe(10);
  });

  it("keeps mock calendars free of overlaps, full surnames, and excluded inquiries", () => {
    const stays = buildMockStays();
    expect(stays.some((stay) => stay.id.startsWith("excluded-"))).toBe(false);
    for (const unit of listUnits()) {
      const mine = stays.filter((stay) => stay.unitId === unit.id).sort((a, b) => a.arrival.localeCompare(b.arrival));
      for (let i = 1; i < mine.length; i += 1) {
        expect(staysOverlap(mine[i - 1], mine[i]), `${unit.id} ${mine[i - 1].arrival} overlaps ${mine[i].arrival}`).toBe(false);
      }
    }
    for (const stay of stays) {
      expect(stay.guest).toMatch(/^(Owner|[A-Z][A-Za-z'-]+ [A-Z]\.)$/);
    }
    const raw = JSON.stringify(buildRawMockStays());
    expect(raw).toContain("cancelled");
    expect(raw).toContain("inquiry");
  });
});

describe("occupancy and dates", () => {
  it("counts guest nights once and leaves owner blocks out of the percentage", () => {
    const result = occupancyForMonth("2026-11", [
      { arrival: "2026-10-30", departure: "2026-11-03", kind: "guest" },
      { arrival: "2026-11-05", departure: "2026-11-08", kind: "guest" },
      { arrival: "2026-11-10", departure: "2026-11-12", kind: "owner" },
      { arrival: "2026-11-02", departure: "2026-11-04", kind: "owner" },
    ]);
    expect(result.guestNights).toBe(5);
    expect(result.ownerNights).toBe(3);
    expect(result.total).toBe(30);
    expect(result.percent).toBe(17);
    expect(eachNight("2026-11-05", "2026-11-09")).toEqual(["2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
  });

  it("opens a six-month window at November 2026", () => {
    expect(windowMonths("2026-11-05")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
      "2027-03",
      "2027-04",
    ]);
    expect(windowMonths("2026-01-15")[0]).toBe("2026-11");
    expect(windowMonths("2027-02-02")[0]).toBe("2027-02");
    expect(reportingMonths("2026-11-05", windowMonths("2026-11-05"))).toEqual(["2026-11", "2026-12"]);
  });
});

describe("golf cart calendar", () => {
  it("maps tags, including a curly apostrophe, and prefers the longer tag", () => {
    const mappings = listTagMappings();
    expect(matchTag("Weekend (7A)", mappings)?.unitId).toBe("porter-vibe");
    expect(matchTag("Cart (A)", mappings)?.unitId).toBe("peaceful-pearl");
    expect(matchTag("Family (Donald\u2019s)", mappings)?.unitId).toBe("peaceful-pearl");
    expect(matchTag("(19) morning", mappings)?.unitId).toBe("porter-pulse-19");
    expect(matchTag("Shop maintenance", mappings)).toBeNull();
  });

  it("parses all-day, timed, folded, and cancelled events", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "X-WR-CALNAME:STR Golf Cart Rentals",
      "BEGIN:VEVENT",
      "UID:fold@example",
      "DTSTART;VALUE=DATE:20261106",
      "DTEND;VALUE=DATE:20261109",
      "SUMMARY:Golf cart (A) — Harper",
      "  Lang",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:timed@example",
      "DTSTART:20261114T150000Z",
      "DTEND:20261114T210000Z",
      "SUMMARY:(7A) — Owen Briggs",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:cancel@example",
      "DTSTART;VALUE=DATE:20261120",
      "DTEND;VALUE=DATE:20261121",
      "STATUS:CANCELLED",
      "SUMMARY:(19) — Should Not Show",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const parsed = parseIcs(ics, listTagMappings());
    const folded = parsed.events.find((event) => event.id === "fold@example");
    expect(folded).toMatchObject({ unitId: "peaceful-pearl", label: "Harper L.", start: "2026-11-06", end: "2026-11-09" });
    const timed = parsed.events.find((event) => event.id === "timed@example");
    expect(timed).toMatchObject({ unitId: "porter-vibe", label: "Owen B.", start: "2026-11-14", end: "2026-11-15" });
    expect(parsed.events.some((event) => event.label.includes("Should"))).toBe(false);
  });

  it("builds a mock feed with redacted names and one untagged event", () => {
    const parsed = parseIcs(buildMockIcs(), listTagMappings());
    expect(parsed.calendarName).toBe("STR Golf Cart Rentals");
    expect(parsed.unmatched).toBe(1);
    const serialized = JSON.stringify(parsed.events);
    expect(serialized).not.toContain("555");
    expect(serialized).not.toContain("Duval");
    expect(serialized).not.toContain("Sato");
    expect(parsed.events.some((event) => event.label === "Camille D." && event.unitId === "peaceful-pearl")).toBe(true);
    expect(parsed.events.some((event) => event.label === "Family weekend" && event.unitId === "peaceful-pearl")).toBe(true);
    const pearl = parsed.events.filter((event) => event.unitId === "peaceful-pearl");
    for (let i = 0; i < pearl.length; i += 1) {
      for (let j = i + 1; j < pearl.length; j += 1) {
        const overlap = pearl[i].start < pearl[j].end && pearl[j].start < pearl[i].end;
        expect(overlap, `${pearl[i].start} overlaps ${pearl[j].start}`).toBe(false);
      }
    }
  });
});

describe("access", () => {
  it("shows an owner only their units, even if they ask for someone else's", async () => {
    const assignments = seedAssignmentMap();
    const james = toPublicAccount(listAccounts().find((account) => account.id === "james")!);
    const elena = toPublicAccount(listAccounts().find((account) => account.id === "elena")!);
    const admin = toPublicAccount(listAccounts().find((account) => account.id === "marina")!);
    expect(unitsVisibleTo(james, listUnits(), assignments).map((unit) => unit.id)).toEqual([
      "peaceful-pearl",
      "porter-vibe",
    ]);
    expect(unitsVisibleTo(admin, listUnits(), assignments)).toHaveLength(8);
    const snapshot = await loadSnapshot(NOW);
    const view = buildPortalView({
      account: elena,
      units: listUnits(),
      assignments,
      snapshot,
      unit: "peaceful-pearl",
      month: "2026-11",
      now: NOW,
    });
    expect(view.selected?.id).toBe("picture-book-cottage");
    expect(view.units.map((unit) => unit.name)).toEqual([
      "Picture Book Cottage",
      "Pass Picture Book",
      "Pass Porch",
    ]);
    expect(view.calendarStays.every((stay) => stay.unitId === "picture-book-cottage")).toBe(true);
    expect(view.inHouse?.guest).toBe("Harper L.");
    expect(view.month).toBe("2026-11");
    expect(view.occupancy.map((item) => item.month)).toEqual(["2026-11", "2026-12"]);

    const pearl = buildPortalView({
      account: james,
      units: listUnits(),
      assignments,
      snapshot,
      unit: "peaceful-pearl",
      month: "2026-11",
      now: NOW,
    });
    expect(pearl.inHouse?.guest).toBe("Camille D.");
    expect(pearl.selected?.hasGolfCart).toBe(true);
    expect(pearl.calendarCarts.length).toBeGreaterThan(0);
    expect(pearl.calendarCarts.every((cart) => cart.unitId === "peaceful-pearl")).toBe(true);
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
  });

  it("signs a session and rejects tampering", () => {
    process.env.SESSION_SECRET = "test-secret";
    const token = signSession("elena", Date.parse("2026-11-05T00:00:00Z"));
    expect(readSessionToken(token, Date.parse("2026-11-05T00:00:00Z"))?.uid).toBe("elena");
    expect(readSessionToken(`${token}x`, Date.parse("2026-11-05T00:00:00Z"))).toBeNull();
    expect(passwordsMatch("coastal-preview", "coastal-preview")).toBe(true);
    expect(passwordsMatch("coastal-preview", "nope")).toBe(false);
  });
});

describe("calendar layout", () => {
  it("clips a stay to the week and stacks overlaps into lanes", () => {
    const week = Array.from({ length: 7 }, (_, index) => ({ iso: addDays("2026-11-01", index) }));
    const bars = barsForWeek(week, [
      { id: "a", start: "2026-10-30", end: "2026-11-04", label: "Harper L.", tone: "guest" },
      { id: "b", start: "2026-11-02", end: "2026-11-03", label: "Extra", tone: "pending" },
    ]);
    const harper = bars.find((bar) => bar.id === "a");
    expect(harper).toMatchObject({ col: 0, span: 3, roundStart: false, roundEnd: true });
    expect(bars.find((bar) => bar.id === "b")?.lane).toBe(1);
  });
});

describe("owners", () => {
  it("seeds the Gulf Coast houses and their owners", () => {
    expect(listUnits().map((unit) => unit.name)).toEqual([
      "Picture Book Cottage",
      "Pass Picture Book",
      "Pass Porch",
      "Peaceful Pearl",
      "Porter Vibe",
      "Marée Maison",
      "Porter Bloom",
      "Porter Pulse #19",
    ]);
    expect(ownerAccounts().map((owner) => owner.name).sort()).toEqual([
      "Chris Dalton",
      "Elena Voss",
      "James Okonkwo",
      "Priya Nandakumar",
    ]);
  });
});

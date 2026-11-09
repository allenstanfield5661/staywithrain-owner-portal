import { listUnits } from "@/lib/catalog";
import { addDays } from "@/lib/dates";
import { renderIcs } from "@/lib/ics";
import { toPublicStay, type PublicStay, type RawStay } from "@/lib/stays";

const GUESTS = [
  ["Harper", "Lang"],
  ["Owen", "Briggs"],
  ["Maya", "Chen"],
  ["Leo", "Park"],
  ["Nina", "Alvarez"],
  ["Samir", "Qureshi"],
  ["Jules", "Moreau"],
  ["Adaeze", "Okoye"],
  ["Finn", "Gallagher"],
  ["Rosa", "Delgado"],
  ["Theo", "Marsh"],
  ["Willa", "Brooks"],
  ["Kenji", "Sato"],
  ["Amara", "Singh"],
  ["Luca", "Ferraro"],
  ["Noor", "Haddad"],
  ["Elise", "Brennan"],
  ["Jonah", "Peck"],
  ["Camille", "Duval"],
  ["Henry", "Cho"],
  ["Sable", "Wright"],
  ["Omar", "Farouk"],
  ["Greta", "Holm"],
  ["Idris", "Bell"],
  ["Paloma", "Reyes"],
  ["Nate", "Kim"],
] as const;

const CHANNELS = ["Airbnb", "Vrbo", "Direct", "Booking.com"];
const NIGHTS = [4, 5, 4, 3, 5];
const GAPS = [1, 2, 1, 1, 2];

const SEEDS: Record<string, number> = {
  "picture-book-cottage": 0,
  "pass-picture-book": 1,
  "pass-porch": 2,
  "peaceful-pearl": 3,
  "porter-vibe": 4,
  "maree-maison": 5,
  "porter-bloom": 6,
  "porter-pulse-19": 7,
};

const FILL_START: Record<string, string> = {
  "picture-book-cottage": "2026-11-10",
  "pass-picture-book": "2026-10-30",
  "pass-porch": "2026-11-01",
  "peaceful-pearl": "2026-11-09",
  "porter-vibe": "2026-10-31",
  "maree-maison": "2026-11-02",
  "porter-bloom": "2026-11-04",
  "porter-pulse-19": "2026-10-29",
};

export function fillStays(unitId: string, seed: number, start: string, end: string): RawStay[] {
  const stays: RawStay[] = [];
  let cursor = start;
  for (let i = 0; i < 60 && cursor < end; i += 1) {
    const owner = (i + seed) % 6 === 5;
    const nights = owner ? 4 : NIGHTS[(i + seed) % NIGHTS.length];
    const gap = GAPS[(i + seed) % GAPS.length];
    const departure = addDays(cursor, nights);
    const guest = GUESTS[(i * 2 + seed * 3) % GUESTS.length];
    let status = "new";
    if (owner) status = "ownerStay";
    else if (i === 1 && seed % 4 === 0) status = "modified";
    else if (i === 4 && seed % 4 === 2) status = "pending";
    stays.push({
      id: `${unitId}-${cursor}`,
      unitId,
      firstName: owner ? "" : guest[0],
      lastName: owner ? "" : guest[1],
      arrival: cursor,
      departure,
      channel: owner ? "Owner" : CHANNELS[(i + seed) % CHANNELS.length],
      status,
    });
    cursor = addDays(departure, gap);
  }
  return stays;
}

export function buildRawMockStays(): RawStay[] {
  const featured: RawStay[] = [
    {
      id: "picture-book-cottage-featured",
      unitId: "picture-book-cottage",
      firstName: "Harper",
      lastName: "Lang",
      arrival: "2026-11-05",
      departure: "2026-11-09",
      channel: "Airbnb",
      status: "new",
    },
    {
      id: "peaceful-pearl-featured",
      unitId: "peaceful-pearl",
      firstName: "Camille",
      lastName: "Duval",
      arrival: "2026-11-03",
      departure: "2026-11-08",
      channel: "Airbnb",
      status: "modified",
    },
  ];
  const generated = listUnits().flatMap((unit) =>
    fillStays(unit.id, SEEDS[unit.id] ?? 0, FILL_START[unit.id] ?? "2026-11-01", "2027-05-01"),
  );
  const excluded: RawStay[] = [
    {
      id: "excluded-cancelled",
      unitId: "picture-book-cottage",
      firstName: "Cancelled",
      lastName: "Guest",
      arrival: "2026-11-05",
      departure: "2026-11-09",
      channel: "Airbnb",
      status: "cancelled",
    },
    {
      id: "excluded-canceled-us",
      unitId: "pass-porch",
      firstName: "Canceled",
      lastName: "Guest",
      arrival: "2026-11-08",
      departure: "2026-11-10",
      channel: "Vrbo",
      status: "canceled",
    },
    {
      id: "excluded-declined",
      unitId: "picture-book-cottage",
      firstName: "Declined",
      lastName: "Request",
      arrival: "2026-11-12",
      departure: "2026-11-15",
      channel: "Airbnb",
      status: "declined",
    },
    {
      id: "excluded-inquiry",
      unitId: "peaceful-pearl",
      firstName: "Inquiry",
      lastName: "Person",
      arrival: "2026-11-18",
      departure: "2026-11-20",
      channel: "Airbnb",
      status: "inquiry",
    },
    {
      id: "excluded-inquiry-preapproved",
      unitId: "porter-vibe",
      firstName: "Preapproved",
      lastName: "Inquiry",
      arrival: "2026-11-18",
      departure: "2026-11-21",
      channel: "Airbnb",
      status: "inquiryPreapproved",
    },
    {
      id: "excluded-expired",
      unitId: "porter-bloom",
      firstName: "Expired",
      lastName: "Hold",
      arrival: "2026-12-02",
      departure: "2026-12-05",
      channel: "Vrbo",
      status: "expired",
    },
  ];
  return [...featured, ...generated, ...excluded];
}

export function buildMockStays(): PublicStay[] {
  return buildRawMockStays().flatMap((stay) => {
    const pub = toPublicStay(stay);
    return pub ? [pub] : [];
  });
}

export function buildMockIcs(): string {
  const tags = ["(A)", "(Donald's)", "(7A)", "(19)"];
  const names = [
    "Camille Duval",
    "Jonah Peck",
    "Kenji Sato",
    "Rosa Delgado",
    "Family weekend",
    "Adaeze Okoye",
    "Henry Cho",
    "Willa Brooks",
  ];
  const events: { uid: string; start: string; end: string; summary: string; timed?: boolean }[] = [];
  let cursor = "2026-11-03";
  for (let i = 0; i < 28 && cursor < "2027-04-18"; i += 1) {
    const tag = i === 1 ? "(Donald\u2019s)" : tags[i % tags.length];
    const nights = i === 0 ? 5 : [2, 3, 4, 1][i % 4];
    const who = i === 0 ? "Camille Duval" : i === 5 ? "Kenji Sato 555-0148" : names[i % names.length];
    const start = cursor;
    const end = addDays(start, nights);
    const summary = i === 1 ? `Family weekend ${tag}` : `${tag} — ${who}`;
    events.push({
      uid: `mock-cart-${i}@rainstanfield.example`,
      start,
      end: i === 7 ? start : end,
      summary,
      timed: i === 7,
    });
    cursor = addDays(end, 8);
  }
  events.push({
    uid: "mock-cart-untagged@rainstanfield.example",
    start: "2026-11-15",
    end: "2026-11-16",
    summary: "Shop maintenance",
  });
  return renderIcs(events);
}

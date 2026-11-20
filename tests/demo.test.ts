import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DemoPortal } from "@/components/demo-portal";
import accounts from "@/config/accounts.json";
import cartAliases from "@/config/cart-aliases.json";
import listingLinks from "@/config/listing-links.json";
import units from "@/config/units.json";
import { buildDemoModel, DEMO_PROPERTIES, demoHref } from "@/lib/demo-sample";
import { staysOverlap } from "@/lib/stays";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) =>
    React.createElement("a", { href, ...props }, children),
}));

vi.mock("next/image", () => ({
  default: ({ alt, src, className }: { alt?: string; src: string; className?: string }) =>
    React.createElement("img", { alt, src, className }),
}));

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOW = new Date("2026-11-20T18:00:00Z");

const DEMO_FILES = [
  "app/demo/[[...slug]]/page.tsx",
  "components/demo-portal.tsx",
  "components/demo-banner.tsx",
  "components/demo-action.tsx",
  "lib/demo-sample.ts",
];

function demoSources(): string {
  return DEMO_FILES.map((file) => readFileSync(path.join(root, file), "utf8")).join("\n");
}

function liveNeedles(): string[] {
  const aliases = Object.values(cartAliases.aliases).flat();
  return [
    ...units.flatMap((unit) => [unit.name, unit.id]),
    ...accounts.flatMap((account) => [account.name, account.email, account.password]),
    ...listingLinks.bookableListingIds.map(String),
    ...Object.values(listingLinks.welcomeGuides),
    ...aliases,
    "1010 Calhoun",
    "Ethel Cir",
    "Hostaway",
  ];
}

describe("public sample portal", () => {
  it("builds two fictional Ocean Springs homes around the current month", () => {
    const model = buildDemoModel({ now: NOW });
    expect(model.today).toBe("2026-11-20");
    expect(model.ownerName).toBe("Sample Owner");
    expect(model.ownerLabel).toBe("Gulf Coast Preview");
    expect(model.properties.map((property) => property.name)).toEqual(["Porch Light Cottage", "Bayou Breeze Suite"]);
    expect(model.selected).toMatchObject({
      id: "porch-light-cottage",
      town: "Ocean Springs",
      bedrooms: 3,
      hasGolfCart: true,
    });
    expect(model.months[0]).toBe("2026-11");
    expect(model.months).toHaveLength(6);
    expect(model.inHouse?.guest).toBe("Jordan M.");
    expect(model.inHouse?.channel).toBe("Direct");
    expect(model.recent.map((stay) => stay.guest)).toContain("Sarah K.");
    expect(model.showGolfCart).toBe(true);
    expect(model.calendarCarts.length).toBeGreaterThan(0);

    const stays = [...new Map([...model.upcoming, ...model.recent].map((stay) => [stay.id, stay])).values()].sort((a, b) =>
      a.arrival.localeCompare(b.arrival),
    );
    for (const stay of stays) {
      expect(stay.guest).toMatch(/^(Owner|[A-Z][a-z]+ [A-Z]\.)$/);
      expect(stay.ownerPayout).toBe(stay.lodging - stay.channelFee);
      if (stay.channel === "Direct" && stay.tone !== "owner") expect(stay.channelFee).toBe(0);
      if (stay.channel === "Airbnb") expect(stay.channelFee).toBeGreaterThan(0);
      if (stay.tone === "owner") expect(stay.ownerPayout).toBe(0);
    }
    for (let i = 1; i < stays.length; i += 1) {
      expect(staysOverlap(stays[i - 1], stays[i])).toBe(false);
    }
    expect(stays.some((stay) => stay.channel === "Vrbo")).toBe(true);
    expect(stays.some((stay) => stay.arrival >= "2027-01-01" || stay.departure >= "2027-01-01")).toBe(true);
    expect(model.payoutSummary.onTheBooks).toBeGreaterThan(0);
    expect(model.openStatement?.ownerPayout).toBe(
      model.openStatement?.lines.filter((stay) => stay.tone === "guest").reduce((sum, stay) => sum + stay.ownerPayout, 0),
    );
  });

  it("keeps the sample current when the month changes", () => {
    const later = buildDemoModel({ now: new Date("2027-06-15T18:00:00Z") });
    expect(later.today).toBe("2027-06-15");
    expect(later.months[0]).toBe("2027-06");
    expect(later.inHouse).not.toBeNull();
    expect(later.upcoming.length).toBeGreaterThan(2);
    expect(later.statements.some((statement) => statement.month === "2027-06")).toBe(true);
  });

  it("switches homes, channels, and the single-home layout without mixing calendars", () => {
    const suite = buildDemoModel({ now: NOW, unit: "bayou-breeze-suite" });
    expect(suite.selected.name).toBe("Bayou Breeze Suite");
    expect(suite.selected.bedrooms).toBe(2);
    expect(suite.inHouse?.guest).toBe("Riley S.");
    expect(suite.showGolfCart).toBe(false);
    expect(suite.calendarCarts).toEqual([]);
    expect(suite.upcoming.every((stay) => stay.unitId === "bayou-breeze-suite")).toBe(true);

    const airbnb = buildDemoModel({ now: NOW, view: "reservations", channel: "Airbnb" });
    expect(airbnb.reservationUpcoming.every((stay) => stay.channel === "Airbnb")).toBe(true);
    expect(airbnb.reservationUpcoming.some((stay) => stay.channel === "Direct")).toBe(false);

    const alone = buildDemoModel({ now: NOW, scope: "bayou-breeze-suite" });
    expect(alone.properties).toHaveLength(1);
    expect(alone.selected.id).toBe("bayou-breeze-suite");

    expect(demoHref({ view: "statements", unit: "porch-light-cottage", month: "2026-12" })).toBe(
      "/demo/statements?unit=porch-light-cottage&month=2026-12",
    );
  });

  it("renders the sample portal with the Stay with Rain banner and no live owner data", () => {
    const model = buildDemoModel({ now: NOW, view: "reservations", stay: "porch-light-cottage-2026-11-18" });
    const overview = renderToStaticMarkup(React.createElement(DemoPortal, { model: buildDemoModel({ now: NOW }) }));
    const html = `${overview}${renderToStaticMarkup(React.createElement(DemoPortal, { model }))}`;
    expect(html).toContain("Sample Owner Portal");
    expect(html).toContain("(demo data)");
    expect(html).toContain("Call 228-875-4496");
    expect(html).toContain("tel:2288754496");
    expect(html).toContain("https://www.raindev.com");
    expect(html).toContain("Porch Light Cottage");
    expect(html).toContain("Bayou Breeze Suite");
    expect(html).toContain("Sample Owner");
    expect(html).toContain("Gulf Coast Preview");
    expect(html).toContain("Jordan M.");
    expect(html).toContain("Nightly rate");
    expect(html).toContain("Cleaning fee");
    expect(html).toContain("Owner payout");
    expect(html).toContain("Request an owner block");
    expect(html).not.toContain("Call or text");
    expect(html).not.toMatch(/(^|\s)#[A-Za-z]/);
    for (const needle of liveNeedles()) {
      expect(html, needle).not.toContain(needle);
    }
    const serialized = JSON.stringify(DEMO_PROPERTIES) + JSON.stringify(model);
    for (const needle of liveNeedles()) {
      expect(serialized, needle).not.toContain(needle);
    }
  });

  it("stays off live calendars, blob storage, and auth cookies", () => {
    const source = demoSources();
    expect(source).not.toMatch(/from ["']@\/lib\/(hostaway|snapshot|owner-store|auth|actions|catalog|golfcart-store)/);
    expect(source).not.toMatch(/@netlify\/blobs|SESSION_COOKIE|signSession|loginAction|cookies\(|\/api\/(calendar|admin|golfcart)/);
    expect(source).toContain("Demo mode — sample preview only");
    expect(readFileSync(path.join(root, "components/demo-action.tsx"), "utf8")).not.toContain("fetch(");
    expect(readFileSync(path.join(root, "app/portal/page.tsx"), "utf8")).toContain("requireAccount");
    expect(readFileSync(path.join(root, "app/admin/page.tsx"), "utf8")).toContain("requireAdmin");
    expect(readFileSync(path.join(root, "lib/auth.ts"), "utf8")).toContain('redirect("/")');
  });
});

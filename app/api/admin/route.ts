import { NextResponse } from "next/server";
import { getAccount } from "@/lib/auth";
import { publicOwners } from "@/lib/owner-store";
import { dataMode, readCachedSnapshot } from "@/lib/snapshot";
import { triggerCalendarWarm } from "@/lib/warm-trigger";

export const maxDuration = 8;

export async function GET() {
  try {
    let account;
    try {
      account = await getAccount();
    } catch {
      return NextResponse.json({ ok: false, error: "Admin sign-in required." }, { status: 401 });
    }
    if (!account || account.role !== "admin") {
      return NextResponse.json({ ok: false, error: "Admin sign-in required." }, { status: 401 });
    }
    const now = new Date();
    const owners = await publicOwners();
    const cached = await readCachedSnapshot(now);
    if (!cached) {
      triggerCalendarWarm();
      return NextResponse.json(
        {
          ok: true,
          warming: true,
          owners,
          listings: [],
          sourceNote: dataMode() === "mock" ? "Preview sample" : "Hostaway",
          cartNote: "Still updating",
          warning: "The listing catalog is still updating. Try again in a moment.",
          unmatched: 0,
          fetchedAt: now.toISOString(),
        },
        { headers: { "cache-control": "no-store" } },
      );
    }
    if (cached.stale) triggerCalendarWarm();
    const snapshot = cached.snapshot;
    return NextResponse.json(
      {
        ok: true,
        warming: false,
        stale: cached.stale,
        owners,
        listings: (snapshot.units ?? []).map((unit) => ({ id: unit.id, name: unit.name, town: unit.town })),
        sourceNote: snapshot.source === "mock" ? "Preview sample" : "Hostaway",
        cartNote:
          snapshot.cartSource === "mock"
            ? "Preview sample of STR Golf Cart Rentals"
            : snapshot.cartSource === "ics"
              ? "Connected iCal feed"
              : "Not configured",
        warning: snapshot.warning,
        unmatched: snapshot.unmatchedCarts,
        fetchedAt: snapshot.fetchedAt,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The admin page could not be loaded.";
    return NextResponse.json({ ok: false, error: message }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}

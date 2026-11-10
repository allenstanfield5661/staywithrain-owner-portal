import { NextResponse } from "next/server";
import { getAccount } from "@/lib/auth";
import { readAssignments } from "@/lib/assignments";
import { listUnits, toPublicAccount } from "@/lib/catalog";
import { liveAssignmentMap } from "@/lib/owner-store";
import { readCachedSnapshot } from "@/lib/snapshot";
import { buildPortalView } from "@/lib/view";
import { triggerCalendarWarm } from "@/lib/warm-trigger";

export const maxDuration = 8;

export async function GET(request: Request) {
  const started = Date.now();
  try {
    let account;
    try {
      account = await getAccount();
    } catch {
      return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
    }
    if (!account) {
      return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
    }
    const now = new Date();
    const cached = await readCachedSnapshot(now);
    if (!cached) {
      triggerCalendarWarm();
      return NextResponse.json(
        {
          ok: false,
          warming: true,
          error: "The calendar is still updating. Try again in a moment.",
        },
        { status: 503, headers: { "cache-control": "no-store" } },
      );
    }
    if (cached.stale) triggerCalendarWarm();
    const url = new URL(request.url);
    const publicAccount = toPublicAccount(account);
    const assignments = cached.snapshot.source === "live" ? await liveAssignmentMap() : readAssignments();
    const view = buildPortalView({
      account: publicAccount,
      units: cached.snapshot.units ?? listUnits(),
      assignments,
      snapshot: cached.snapshot,
      unit: url.searchParams.get("unit") ?? undefined,
      month: url.searchParams.get("month") ?? undefined,
      now,
    });
    console.info(
      `calendar api cache-hit ${Date.now() - started}ms stays=${cached.snapshot.stays.length}${cached.stale ? " stale" : ""}`,
    );
    return NextResponse.json(
      {
        ok: true,
        stale: cached.stale,
        view,
        snapshot: cached.snapshot,
        assignments,
        account: publicAccount,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The calendar could not be loaded.";
    console.info(`calendar api failed ${Date.now() - started}ms`);
    return NextResponse.json({ ok: false, error: message }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}

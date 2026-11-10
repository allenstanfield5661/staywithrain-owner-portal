import { NextResponse } from "next/server";
import { cartCountsByUnit, warmSnapshot } from "@/lib/snapshot";

export const maxDuration = 26;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return (request.headers.get("authorization") ?? "") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const started = Date.now();
  try {
    const snapshot = await warmSnapshot(new Date(), { force: true });
    const body = {
      ok: true,
      units: snapshot.units?.length ?? 0,
      stays: snapshot.stays.length,
      carts: snapshot.carts.length,
      cartByUnit: cartCountsByUnit(snapshot.carts),
      unmatchedCarts: snapshot.unmatchedCarts,
      cartSource: snapshot.cartSource,
      ms: Date.now() - started,
    };
    console.info(`cron warm ${JSON.stringify(body)}`);
    return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Warm failed";
    console.info(`cron warm failed ${Date.now() - started}ms ${message}`);
    return NextResponse.json({ ok: false, error: "The calendar could not be refreshed." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}

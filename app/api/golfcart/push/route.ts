import { NextResponse } from "next/server";
import { parsePushBody, writePushedGolfCartEvents } from "@/lib/golfcart-store";
import { warmSnapshot } from "@/lib/snapshot";

export const maxDuration = 26;

function isAuthorized(request: Request): boolean {
  const secret = process.env.GOLF_CART_PUSH_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON body required." }, { status: 400 });
  }
  let events;
  try {
    events = parsePushBody(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid body.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
  try {
    await writePushedGolfCartEvents(events);
  } catch {
    return NextResponse.json({ ok: false, error: "Could not store golf cart events." }, { status: 500 });
  }
  // Refresh the calendar cache so owners see the new carts promptly.
  try {
    await warmSnapshot(new Date(), { force: true });
  } catch {
    // Storage succeeded; the scheduled warm will pick it up.
  }
  return NextResponse.json(
    { ok: true, accepted: events.length },
    { headers: { "cache-control": "no-store" } },
  );
}

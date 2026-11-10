import { warmSnapshot } from "@/lib/snapshot";

export const config = {
  schedule: "*/10 * * * *",
};

function isAuthorized(request: Request | undefined): boolean {
  if (!request) return true;
  const event = request.headers.get("x-nf-event") || request.headers.get("X-NF-Event");
  if (event === "schedule") return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return (request.headers.get("authorization") ?? "") === `Bearer ${secret}`;
}

export default async (request: Request) => {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const started = Date.now();
  try {
    const snapshot = await warmSnapshot(new Date());
    const body = JSON.stringify({
      ok: true,
      units: snapshot.units?.length ?? 0,
      stays: snapshot.stays.length,
      ms: Date.now() - started,
    });
    console.info(`warm-calendar ${body}`);
    return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Warm failed";
    console.info(`warm-calendar failed ${Date.now() - started}ms ${message}`);
    return new Response(JSON.stringify({ ok: false, error: "The calendar could not be refreshed." }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};

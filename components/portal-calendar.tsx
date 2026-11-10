"use client";

import { useCallback, useEffect, useState } from "react";
import { PortalViewBody } from "@/components/portal-view";
import { Button } from "@/components/ui/button";
import type { PortalView } from "@/lib/view";

type CalendarResponse = {
  ok: boolean;
  warming?: boolean;
  error?: string;
  view?: PortalView;
};

export function PortalCalendar({
  unit,
  month,
}: {
  unit?: string;
  month?: string;
}) {
  const [view, setView] = useState<PortalView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warming, setWarming] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (unit) params.set("unit", unit);
    if (month) params.set("month", month);
    const query = params.toString();
    try {
      const response = await fetch(`/api/calendar${query ? `?${query}` : ""}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      const payload = (await response.json()) as CalendarResponse;
      if (payload.ok && payload.view) {
        setView(payload.view);
        setWarming(false);
        setError(null);
        return;
      }
      setView(null);
      setWarming(Boolean(payload.warming));
      setError(payload.error || "The calendar could not be loaded.");
    } catch {
      setView(null);
      setWarming(false);
      setError("The calendar could not be loaded. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [unit, month]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!warming) return;
    const timer = window.setTimeout(() => {
      void load();
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [warming, load]);

  if (view) return <PortalViewBody view={view} />;

  return (
    <div className="rounded-2xl bg-card px-5 py-8 ring-1 ring-foreground/10">
      <h1 className="font-heading text-3xl tracking-tight text-sea">
        {loading || warming ? "Loading the calendar…" : "The calendar could not be loaded"}
      </h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        {loading && !warming
          ? "Fetching your bookings."
          : error || "The booking feed is still updating. Try again in a moment."}
      </p>
      {!loading ? (
        <Button type="button" className="mt-6 w-fit" onClick={() => void load()}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

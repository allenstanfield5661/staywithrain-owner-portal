"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PortalViewBody } from "@/components/portal-view";
import { Button } from "@/components/ui/button";
import type { PublicAccount } from "@/lib/catalog";
import type { Snapshot } from "@/lib/snapshot";
import { buildPortalView, type PortalView } from "@/lib/view";

type CalendarResponse = {
  ok: boolean;
  warming?: boolean;
  stale?: boolean;
  error?: string;
  view?: PortalView;
  snapshot?: Snapshot;
  assignments?: Record<string, string | null>;
  account?: PublicAccount;
};

type LocalCache = {
  snapshot: Snapshot;
  assignments: Record<string, string | null>;
};

const STORAGE_KEY = "swr-calendar-cache";

function readLocalCache(): LocalCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalCache;
    if (!parsed?.snapshot || !parsed.assignments) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocalCache(cache: LocalCache): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Private mode or a full store should not break the page.
  }
}

function viewFromCache(cache: LocalCache, account: PublicAccount, unit?: string, month?: string): PortalView {
  return buildPortalView({
    account,
    units: cache.snapshot.units ?? [],
    assignments: cache.assignments,
    snapshot: cache.snapshot,
    unit,
    month,
    now: new Date(),
  });
}

export function PortalCalendar({
  account,
  unit,
  month,
}: {
  account: PublicAccount;
  unit?: string;
  month?: string;
}) {
  const [cache, setCache] = useState<LocalCache | null>(() => readLocalCache());
  const [error, setError] = useState<string | null>(null);
  const [warming, setWarming] = useState(false);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(!readLocalCache());
  const fetchedOnce = useRef(false);
  const cacheRef = useRef(cache);
  cacheRef.current = cache;

  const view = useMemo(() => {
    if (!cache) return null;
    try {
      return viewFromCache(cache, account, unit, month);
    } catch {
      return null;
    }
  }, [cache, account, unit, month]);

  const applyPayload = useCallback(
    (payload: CalendarResponse) => {
      if (payload.snapshot && payload.assignments) {
        const next = { snapshot: payload.snapshot, assignments: payload.assignments };
        setCache(next);
        writeLocalCache(next);
      }
      if (payload.ok) {
        setWarming(false);
        setError(null);
        setStale(Boolean(payload.stale));
        return true;
      }
      return false;
    },
    [],
  );

  const load = useCallback(
    async (background: boolean) => {
      if (!background) {
        setLoading((current) => current || !cacheRef.current);
        setError(null);
      }
      try {
        const response = await fetch("/api/calendar", {
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        const payload = (await response.json()) as CalendarResponse;
        if (applyPayload(payload)) return;
        setWarming(Boolean(payload.warming));
        if (!cacheRef.current && !payload.snapshot) {
          setError(payload.error || "The calendar could not be loaded.");
        }
      } catch {
        if (!cacheRef.current) setError("The calendar could not be loaded. Check your connection and try again.");
        setWarming(false);
      } finally {
        setLoading(false);
      }
    },
    [applyPayload],
  );

  useEffect(() => {
    if (fetchedOnce.current) return;
    fetchedOnce.current = true;
    void load(Boolean(cache));
  }, [cache, load]);

  useEffect(() => {
    if (!warming) return;
    const timer = window.setTimeout(() => {
      void load(true);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [warming, load]);

  if (view) {
    return (
      <div>
        {stale ? (
          <p className="mb-4 text-sm text-muted-foreground">Showing the last saved calendar while a refresh runs in the background.</p>
        ) : null}
        <PortalViewBody view={view} />
      </div>
    );
  }

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
        <Button type="button" className="mt-6 w-fit" onClick={() => void load(false)}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

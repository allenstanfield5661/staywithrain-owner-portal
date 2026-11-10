"use client";

import { useCallback, useEffect, useState } from "react";
import { LiveOwnersEditor } from "@/components/live-owners-editor";
import { Button } from "@/components/ui/button";
import type { PublicOwner } from "@/lib/owner-store";

type AdminResponse = {
  ok: boolean;
  warming?: boolean;
  error?: string;
  owners?: PublicOwner[];
  listings?: { id: string; name: string; town: string }[];
  sourceNote?: string;
  cartNote?: string;
  warning?: string;
  unmatched?: number;
};

export function AdminOwnersPanel() {
  const [payload, setPayload] = useState<AdminResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin", { cache: "no-store", signal: AbortSignal.timeout(8000) });
      const body = (await response.json()) as AdminResponse;
      if (!body.ok && !body.owners) {
        setError(body.error || "The admin page could not be loaded.");
        return;
      }
      setPayload(body);
      setError(body.ok ? null : body.error || null);
    } catch {
      setError("The admin page could not be loaded. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!payload?.warming) return;
    const timer = window.setTimeout(() => {
      void load();
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [payload?.warming, load]);

  const sourceNote = payload?.sourceNote ?? "Hostaway";
  const cartNote = payload?.cartNote ?? "Still updating";
  const warning = payload?.warning ?? error ?? undefined;
  const unmatched = payload?.unmatched ?? 0;

  return (
    <>
      <div className="mb-6">
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Admin</p>
        <h1 className="mt-1 font-heading text-4xl tracking-tight text-sea sm:text-5xl">Owners and units</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Each house belongs to one owner. That owner sees only their units. You can open every calendar.
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">Reservations</dt>
            <dd className="mt-1 font-medium">{sourceNote}</dd>
          </div>
          <div className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">Golf cart calendar</dt>
            <dd className="mt-1 font-medium">{cartNote}</dd>
            {unmatched > 0 ? (
              <dd className="mt-1 text-xs text-muted-foreground">{unmatched} events had no unit tag.</dd>
            ) : null}
          </div>
        </dl>
        {warning ? <p className="mt-3 text-sm text-brass">{warning}</p> : null}
        {loading ? <p className="mt-3 text-sm text-muted-foreground">Loading listings…</p> : null}
        {error && !payload?.owners ? (
          <Button type="button" className="mt-4 w-fit" onClick={() => void load()}>
            Try again
          </Button>
        ) : null}
      </div>
      {payload || !loading ? (
        <LiveOwnersEditor
          key={`${(payload?.owners ?? []).length}-${(payload?.listings ?? []).length}`}
          owners={payload?.owners ?? []}
          listings={payload?.listings ?? []}
        />
      ) : null}
    </>
  );
}

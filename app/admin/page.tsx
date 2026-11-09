import { Suspense } from "react";
import { AssignmentEditor } from "@/components/assignment-editor";
import { LiveOwnersEditor } from "@/components/live-owners-editor";
import { PortalShell } from "@/components/portal-shell";
import { PortalSkeleton } from "@/components/portal-skeleton";
import { readAssignments } from "@/lib/assignments";
import { publicOwners } from "@/lib/owner-store";
import { currentInstant } from "@/lib/clock";
import { requireAdmin } from "@/lib/auth";
import { listUnits, ownerAccounts, toPublicAccount } from "@/lib/catalog";
import { GULF_TZ, reportingMonths, todayInTimeZone, windowMonths } from "@/lib/dates";
import { dataMode, loadSnapshot } from "@/lib/snapshot";

export default function AdminPage() {
  return (
    <Suspense fallback={<PortalSkeleton />}>
      <AdminContent />
    </Suspense>
  );
}

async function AdminContent() {
  const account = await requireAdmin();
  const now = await currentInstant();
  const publicAccount = toPublicAccount(account);
  let sourceNote = dataMode() === "mock" ? "Preview sample" : "Hostaway";
  let cartNote = "Not loaded";
  let warning: string | undefined;
  let unmatched = 0;
  let fetchedAt = now.toISOString();
  let listings: { id: string; name: string; town: string }[] = [];
  try {
    const snapshot = await loadSnapshot(now);
    listings = (snapshot.units ?? []).map((unit) => ({ id: unit.id, name: unit.name, town: unit.town }));
    fetchedAt = snapshot.fetchedAt;
    sourceNote = snapshot.source === "mock" ? "Preview sample" : "Hostaway";
    cartNote =
      snapshot.cartSource === "mock"
        ? "Preview sample of STR Golf Cart Rentals"
        : snapshot.cartSource === "ics"
          ? "Connected iCal feed"
          : "Not configured";
    warning = snapshot.warning;
    unmatched = snapshot.unmatchedCarts;
  } catch (error) {
    warning = error instanceof Error ? error.message : "The booking feed could not be loaded.";
  }
  const today = todayInTimeZone(GULF_TZ, now);
  const month = reportingMonths(today, windowMonths(today))[0];

  return (
    <PortalShell account={publicAccount} fetchedAt={fetchedAt} source={dataMode()} mode="admin">
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
      </div>
      {dataMode() === "live" ? (
        <LiveOwnersEditor
          owners={await publicOwners()}
          listings={listings}
        />
      ) : (
        <AssignmentEditor
          units={listUnits().map((unit) => ({
            id: unit.id,
            name: unit.name,
            town: unit.town,
            bedrooms: unit.bedrooms,
          }))}
          owners={ownerAccounts()}
          assignments={readAssignments()}
          month={month}
        />
      )}
    </PortalShell>
  );
}

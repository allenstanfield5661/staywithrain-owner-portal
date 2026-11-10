import { Suspense } from "react";
import { AssignmentEditor } from "@/components/assignment-editor";
import { AdminOwnersPanel } from "@/components/admin-owners-panel";
import { PortalErrorBoundary } from "@/components/portal-error-boundary";
import { PortalShell } from "@/components/portal-shell";
import { PortalSkeleton } from "@/components/portal-skeleton";
import { readAssignments } from "@/lib/assignments";
import { requireAdmin } from "@/lib/auth";
import { listUnits, ownerAccounts, toPublicAccount } from "@/lib/catalog";
import { currentInstant } from "@/lib/clock";
import { GULF_TZ, reportingMonths, todayInTimeZone, windowMonths } from "@/lib/dates";
import { dataMode } from "@/lib/snapshot";

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
  const mode = dataMode();
  const today = todayInTimeZone(GULF_TZ, now);
  const month = reportingMonths(today, windowMonths(today))[0];

  return (
    <PortalShell account={publicAccount} fetchedAt={now.toISOString()} source={mode} mode="admin">
      <PortalErrorBoundary title="Owners could not be shown">
        {mode === "live" ? (
          <AdminOwnersPanel />
        ) : (
          <>
            <div className="mb-6">
              <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Admin</p>
              <h1 className="mt-1 font-heading text-4xl tracking-tight text-sea sm:text-5xl">Owners and units</h1>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                Each house belongs to one owner. That owner sees only their units. You can open every calendar.
              </p>
            </div>
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
          </>
        )}
      </PortalErrorBoundary>
    </PortalShell>
  );
}

import { AssignmentEditor } from "@/components/assignment-editor";
import { AdminOwnersPanel } from "@/components/admin-owners-panel";
import { PortalShell } from "@/components/portal-shell";
import { readAssignments } from "@/lib/assignments";
import { requireAdmin } from "@/lib/auth";
import { listUnits, ownerAccounts, toPublicAccount } from "@/lib/catalog";
import { GULF_TZ, reportingMonths, todayInTimeZone, windowMonths } from "@/lib/dates";
import { dataMode } from "@/lib/snapshot";

export default async function AdminPage() {
  const account = await requireAdmin();
  const publicAccount = toPublicAccount(account);
  const mode = dataMode();
  const today = todayInTimeZone(GULF_TZ, new Date());
  const month = reportingMonths(today, windowMonths(today))[0];

  return (
    <PortalShell account={publicAccount} fetchedAt={new Date().toISOString()} source={mode} mode="admin">
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
    </PortalShell>
  );
}

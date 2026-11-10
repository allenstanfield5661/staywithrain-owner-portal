import { Suspense } from "react";
import { PortalCalendar } from "@/components/portal-calendar";
import { PortalErrorBoundary } from "@/components/portal-error-boundary";
import { PortalShell } from "@/components/portal-shell";
import { PortalSkeleton } from "@/components/portal-skeleton";
import { requireAccount } from "@/lib/auth";
import { toPublicAccount } from "@/lib/catalog";
import { currentInstant } from "@/lib/clock";
import { dataMode } from "@/lib/snapshot";

export default function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string | string[]; month?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<PortalSkeleton />}>
      <PortalContent searchParams={searchParams} />
    </Suspense>
  );
}

async function PortalContent({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string | string[]; month?: string | string[] }>;
}) {
  const account = await requireAccount();
  const now = await currentInstant();
  const params = await searchParams;
  const unit = Array.isArray(params.unit) ? params.unit[0] : params.unit;
  const month = Array.isArray(params.month) ? params.month[0] : params.month;
  const publicAccount = toPublicAccount(account);
  return (
    <PortalShell account={publicAccount} fetchedAt={now.toISOString()} source={dataMode()} mode="portal">
      <PortalErrorBoundary title="The calendar could not be shown">
        <PortalCalendar account={publicAccount} unit={unit} month={month} />
      </PortalErrorBoundary>
    </PortalShell>
  );
}

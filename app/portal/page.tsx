import { PortalCalendar } from "@/components/portal-calendar";
import { PortalShell } from "@/components/portal-shell";
import { requireAccount } from "@/lib/auth";
import { toPublicAccount } from "@/lib/catalog";
import { dataMode } from "@/lib/snapshot";

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string | string[]; month?: string | string[] }>;
}) {
  const account = await requireAccount();
  const params = await searchParams;
  const unit = Array.isArray(params.unit) ? params.unit[0] : params.unit;
  const month = Array.isArray(params.month) ? params.month[0] : params.month;
  return (
    <PortalShell account={toPublicAccount(account)} fetchedAt={new Date().toISOString()} source={dataMode()} mode="portal">
      <PortalCalendar unit={unit} month={month} />
    </PortalShell>
  );
}

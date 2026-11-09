import { Suspense } from "react";
import Link from "next/link";
import { MonthCalendar } from "@/components/month-calendar";
import { PortalShell } from "@/components/portal-shell";
import { PortalSkeleton } from "@/components/portal-skeleton";
import { StaysTable } from "@/components/stays-table";
import { readAssignments } from "@/lib/assignments";
import { liveAssignmentMap } from "@/lib/owner-store";
import { currentInstant } from "@/lib/clock";
import { requireAccount } from "@/lib/auth";
import type { CalendarEvent } from "@/lib/calendar-layout";
import { toPublicAccount, listUnits } from "@/lib/catalog";
import { formatMonth, formatMonthShort, formatStayDate } from "@/lib/dates";
import { dataMode, loadSnapshot, type Snapshot } from "@/lib/snapshot";
import { buildPortalView, portalHref } from "@/lib/view";
import { cn } from "@/lib/utils";

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
  const publicAccount = toPublicAccount(account);
  const params = await searchParams;
  let snapshot: Snapshot | null = null;
  let loadError: string | null = null;
  try {
    snapshot = await loadSnapshot(now);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "The booking feed could not be loaded.";
  }

  if (!snapshot) {
    return (
      <PortalShell account={publicAccount} fetchedAt={now.toISOString()} source={dataMode()} mode="portal">
        <div className="rounded-2xl bg-card px-5 py-8 ring-1 ring-foreground/10">
          <h1 className="font-heading text-3xl tracking-tight text-sea">The calendar could not be loaded</h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">{loadError}</p>
        </div>
      </PortalShell>
    );
  }

  const view = buildPortalView({
    account: publicAccount,
    units: snapshot.units ?? listUnits(),
    assignments: snapshot.source === "live" ? await liveAssignmentMap() : readAssignments(),
    snapshot,
    unit: params.unit,
    month: params.month,
    now,
  });
  const selected = view.selected;
  const monthIndex = view.months.indexOf(view.month);
  const prevMonth = monthIndex > 0 ? view.months[monthIndex - 1] : null;
  const nextMonth = monthIndex >= 0 && monthIndex < view.months.length - 1 ? view.months[monthIndex + 1] : null;
  const monthLinks = selected
    ? view.months.map((key) => ({
        key,
        href: portalHref(selected.id, key),
        label: formatMonthShort(key),
      }))
    : [];

  const stayEvents: CalendarEvent[] = view.calendarStays.map((stay) => ({
    id: stay.id,
    start: stay.arrival,
    end: stay.departure,
    label: stay.tone === "owner" ? "Owner" : stay.guest,
    tone: stay.tone,
  }));
  const cartEvents: CalendarEvent[] = view.calendarCarts.map((cart) => ({
    id: cart.id,
    start: cart.start,
    end: cart.end,
    label: cart.label,
    tone: "cart",
  }));
  const showGolf = view.source === "live" ? cartEvents.length > 0 : Boolean(selected?.hasGolfCart);
  const legend = [
    { tone: "guest" as const, label: "Guest stay" },
    { tone: "owner" as const, label: "Owner stay" },
    ...(stayEvents.some((event) => event.tone === "pending")
      ? [{ tone: "pending" as const, label: "Pending hold" }]
      : []),
  ];

  return (
    <PortalShell account={publicAccount} fetchedAt={view.fetchedAt} source={view.source} mode="portal">
      {view.units.length === 0 || !selected ? (
        <div className="rounded-2xl bg-card px-5 py-10 ring-1 ring-foreground/10">
          <h1 className="font-heading text-4xl tracking-tight text-sea">No units on this login</h1>
          <p className="mt-3 max-w-lg text-sm text-muted-foreground">
            Rain / Stanfield has not assigned a house to this account yet. An admin can connect one from Manage owners.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {view.units.length > 1 ? (
            <nav aria-label="Your units" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {view.units.map((unit) => {
                const active = unit.id === selected.id;
                return (
                  <Link
                    key={unit.id}
                    href={portalHref(unit.id, view.month)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1.5 text-sm",
                      active ? "bg-sea text-[#f6f3ec]" : "bg-card ring-1 ring-border hover:bg-muted",
                    )}
                  >
                    {unit.name}
                  </Link>
                );
              })}
            </nav>
          ) : null}

          <div>
            <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
              {selected.town}, Mississippi
            </p>
            <h1 className="mt-1 font-heading text-4xl tracking-tight text-sea sm:text-5xl">{selected.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {selected.bedrooms} bedrooms
              {showGolf ? ` · Golf cart ${formatTags(selected.tags)}` : ""}
            </p>
            {view.inHouse ? (
              <p className="mt-4 inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full bg-foam px-3 py-1.5 text-sm text-sea">
                <span className="font-medium">In house</span>
                <span>{view.inHouse.guest}</span>
                <span className="text-sea/70">departs {formatStayDate(view.inHouse.departure)}</span>
              </p>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">No one is in the house today.</p>
            )}
            {selected.hostawayLinked === false ? (
              <p className="mt-3 text-sm text-brass">
                {publicAccount.role === "admin"
                  ? "No Hostaway listing matched this name. Set hostawayListingId in config/units.json if the title differs."
                  : "Reservations for this house are not linked yet."}
              </p>
            ) : null}
          </div>

          <section aria-label="Occupancy" className="grid gap-3 sm:grid-cols-2">
            {view.occupancy.map((item) => (
              <article key={item.when} className="rounded-2xl bg-card px-5 py-4 ring-1 ring-foreground/10">
                <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">{item.when}</p>
                <p className="mt-2 font-heading text-5xl tracking-tight text-sea">{item.percent}%</p>
                <p className="mt-1 text-sm">{item.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.guestNights} of {item.total} nights booked
                  {item.ownerNights > 0
                    ? ` · ${item.ownerNights} owner-blocked ${item.ownerNights === 1 ? "night" : "nights"} not included`
                    : ""}
                </p>
              </article>
            ))}
          </section>
          <p className="-mt-4 text-xs text-muted-foreground">
            Occupancy is guest nights divided by the nights in the month. Owner stays are marked on the calendar and left out of the percentage.
          </p>

          <MonthCalendar
            title="Bookings"
            description={formatMonth(view.month)}
            month={view.month}
            today={view.today}
            monthLinks={monthLinks}
            prevHref={prevMonth && selected ? portalHref(selected.id, prevMonth) : null}
            nextHref={nextMonth && selected ? portalHref(selected.id, nextMonth) : null}
            events={stayEvents}
            legend={legend}
            empty="No bookings on this month."
          />

          {showGolf ? (
            view.cartSource === "unconfigured" ? (
              <section className="rounded-2xl bg-card px-5 py-6 ring-1 ring-foreground/10">
                <h2 className="font-heading text-2xl tracking-tight text-sea sm:text-3xl">Golf cart</h2>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  {view.warning ??
                    "The STR Golf Cart Rentals calendar is not connected. Add GOLF_CART_ICS_URL to show rentals tagged for this house."}
                </p>
              </section>
            ) : (
              <MonthCalendar
                title="Golf cart"
                description={`${formatMonth(view.month)} · STR Golf Cart Rentals · tags ${formatTags(selected.tags)}`}
                month={view.month}
                today={view.today}
                events={cartEvents}
                legend={[{ tone: "cart", label: "Cart rental" }]}
                empty="No cart rentals this month."
              />
            )
          ) : null}

          <StaysTable stays={view.upcoming} today={view.today} />

          {publicAccount.role === "admin" && view.warning ? (
            <p className="text-sm text-brass">{view.warning}</p>
          ) : null}
          {publicAccount.role === "admin" && view.unmatchedCarts > 0 ? (
            <p className="text-sm text-muted-foreground">
              {view.unmatchedCarts} golf-cart {view.unmatchedCarts === 1 ? "event was" : "events were"} skipped because the title had no unit tag.
            </p>
          ) : null}

          <footer className="border-t border-border pt-6 text-sm text-muted-foreground">
            Guest names are shortened to a first name and last initial. Payments, payouts, card details, contact
            information, and internal notes are never shown.
            <span className="mt-1 block">Rain / Stanfield · Mississippi Gulf Coast</span>
          </footer>
        </div>
      )}
    </PortalShell>
  );
}

function formatTags(tags: string[]): string {
  if (tags.length <= 1) return tags[0] ?? "";
  if (tags.length === 2) return `${tags[0]} and ${tags[1]}`;
  return `${tags.slice(0, -1).join(", ")}, and ${tags[tags.length - 1]}`;
}

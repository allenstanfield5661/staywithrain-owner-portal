import Link from "next/link";
import { MonthCalendar } from "@/components/month-calendar";
import { PropertyLinksCard } from "@/components/property-links-card";
import { StaysTable } from "@/components/stays-table";
import type { CalendarEvent } from "@/lib/calendar-layout";
import { formatMonth, formatMonthShort, formatStayDate } from "@/lib/dates";
import { portalHref, type PortalView } from "@/lib/view";
import { cn } from "@/lib/utils";

export function PortalViewBody({ view }: { view: PortalView }) {
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

  if (view.units.length === 0 || !selected) {
    return (
      <div className="rounded-2xl bg-card px-5 py-10 ring-1 ring-foreground/10">
        <h1 className="font-heading text-4xl tracking-tight text-sea">No units on this login</h1>
        <p className="mt-3 max-w-lg text-sm text-muted-foreground">
          Rain / Stanfield has not assigned a house to this account yet. An admin can connect one from Manage owners.
        </p>
      </div>
    );
  }

  return (
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
          {selected.hasGolfCart || cartEvents.length > 0 ? " · Golf cart" : ""}
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
            {view.account.role === "admin"
              ? "No Hostaway listing matched this name. Set hostawayListingId in config/units.json if the title differs."
              : "Reservations for this house are not linked yet."}
          </p>
        ) : null}
      </div>

      <PropertyLinksCard
        bookingUrl={selected.bookingUrl}
        welcomeGuideUrl={selected.welcomeGuideUrl}
        propertyName={selected.name}
      />

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
        <MonthCalendar
          title="Golf cart"
          description={`${formatMonth(view.month)} · Golf cart rentals`}
          month={view.month}
          today={view.today}
          events={cartEvents}
          legend={[{ tone: "cart", label: "Cart rental" }]}
          empty="No cart rentals this month."
          listEvents
        />
      ) : null}

      <StaysTable stays={view.upcoming} today={view.today} />

      {view.account.role === "admin" && view.source === "live" && view.cartSource === "unconfigured" ? (
        <p className="text-sm text-muted-foreground">
          Golf cart calendars are not connected. Add GOLF_CART_ICS_URLS with the secret iCal addresses for STR Golf Cart
          Rentals and Subedi Realty Golf Cart.
        </p>
      ) : null}
      {view.account.role === "admin" && view.warning ? (
        <p className="text-sm text-brass">{view.warning}</p>
      ) : null}
      {view.account.role === "admin" && view.unmatchedCarts > 0 ? (
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
  );
}

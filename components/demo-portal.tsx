import Link from "next/link";
import { DemoActionButton } from "@/components/demo-action";
import { DemoBanner } from "@/components/demo-banner";
import { BrandMark } from "@/components/brand-mark";
import { MonthCalendar } from "@/components/month-calendar";
import type { CalendarEvent } from "@/lib/calendar-layout";
import { formatMonth, formatMonthShort, formatStayDate, formatTimestamp } from "@/lib/dates";
import {
  DEMO_BOOKING_SITE,
  DEMO_PROPERTIES,
  demoHref,
  formatDemoMoney,
  type DemoChannel,
  type DemoModel,
  type DemoStay,
  type DemoView,
} from "@/lib/demo-sample";
import { cn } from "@/lib/utils";

const TABS: { id: DemoView; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "calendar", label: "Calendar" },
  { id: "reservations", label: "Reservations" },
  { id: "statements", label: "Statements" },
  { id: "golf-cart", label: "Golf cart" },
];

const CHANNELS: Array<DemoChannel | "all"> = ["all", "Airbnb", "Direct", "Vrbo"];

function hrefFor(model: DemoModel, overrides: Parameters<typeof demoHref>[0] = {}): string {
  return demoHref({
    view: model.view,
    unit: model.selected.id,
    month: model.month,
    scope: model.scope,
    channel: model.view === "calendar" || model.view === "reservations" ? model.channel : "all",
    ...overrides,
  });
}

function chipClass(active: boolean): string {
  return cn(
    "shrink-0 rounded-full px-3 py-1.5 text-sm",
    active ? "bg-sea text-white" : "bg-card ring-1 ring-border hover:bg-muted",
  );
}

function stayEvents(stays: DemoStay[]): CalendarEvent[] {
  return stays.map((stay) => ({
    id: stay.id,
    start: stay.arrival,
    end: stay.departure,
    label: stay.tone === "owner" ? "Owner" : stay.guest,
    tone: stay.tone,
  }));
}

function inHouse(stay: DemoStay, today: string): boolean {
  return stay.arrival <= today && today < stay.departure;
}

export function DemoPortal({ model }: { model: DemoModel }) {
  return (
    <div className="min-h-screen bg-background">
      <a
        href="#portal-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <DemoBanner />
      <header className="bg-sea text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-x-6 gap-y-3 px-4 py-5 sm:px-6">
          <div>
            <BrandMark variant="white-wordmark" priority className="h-8 w-auto sm:h-10" />
            <p className="mt-2 text-[11px] tracking-[0.16em] text-white/75 uppercase">
              Owner portal · Mississippi Gulf Coast
            </p>
          </div>
          <p className="text-right text-xs leading-5 text-white/80 sm:text-sm">
            <span className="block text-[11px] tracking-[0.14em] text-white/55 uppercase">Last updated</span>
            <time dateTime={model.fetchedAt}>{formatTimestamp(model.fetchedAt)}</time>
          </p>
        </div>
      </header>
      <div className="h-1 bg-brass" />
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p className="text-sm">
            <span className="font-medium">{model.ownerName}</span>
            <span className="text-muted-foreground"> · {model.ownerLabel}</span>
          </p>
          <p className="text-sm text-muted-foreground">Sample preview</p>
        </div>
        <nav aria-label="Portal sections" className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3 sm:px-6">
          {TABS.map((tab) => {
            const active = tab.id === model.view;
            return (
              <Link
                key={tab.id}
                href={hrefFor(model, { view: tab.id, stay: undefined, statement: undefined })}
                aria-current={active ? "page" : undefined}
                className={chipClass(active)}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <main id="portal-main" className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
        <HomeSwitcher model={model} />
        <PropertyHeading model={model} />
        {model.view === "overview" ? <Overview model={model} /> : null}
        {model.view === "calendar" ? <CalendarSection model={model} /> : null}
        {model.view === "reservations" ? <Reservations model={model} /> : null}
        {model.view === "statements" ? <Statements model={model} /> : null}
        {model.view === "golf-cart" ? <GolfCart model={model} /> : null}
        <footer className="border-t border-border pt-6 text-sm text-muted-foreground">
          Guest names are a first name and last initial. Stays, rates, and payouts on this page are sample figures for
          the preview.
          <span className="mt-1 block">Stay with Rain · Mississippi Gulf Coast</span>
        </footer>
      </main>
    </div>
  );
}

function HomeSwitcher({ model }: { model: DemoModel }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Homes in this preview">
        <Link href={hrefFor(model, { scope: "both", unit: model.selected.id })} className={chipClass(model.scope === "both")}>
          Both homes
        </Link>
        {DEMO_PROPERTIES.map((property) => (
          <Link
            key={property.id}
            href={hrefFor(model, { scope: property.id, unit: property.id, stay: undefined })}
            className={chipClass(model.scope === property.id)}
          >
            {property.name} only
          </Link>
        ))}
      </div>
      {model.properties.length > 1 ? (
        <nav aria-label="Your units" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {model.properties.map((property) => {
            const active = property.id === model.selected.id;
            return (
              <Link
                key={property.id}
                href={hrefFor(model, { unit: property.id, stay: undefined })}
                aria-current={active ? "page" : undefined}
                className={chipClass(active)}
              >
                {property.name}
              </Link>
            );
          })}
        </nav>
      ) : (
        <p className="text-sm text-muted-foreground">
          Showing one home.{" "}
          <Link href={hrefFor(model, { scope: "both" })} className="font-medium text-sea underline-offset-2 hover:underline">
            Show both homes
          </Link>
        </p>
      )}
    </div>
  );
}

function PropertyHeading({ model }: { model: DemoModel }) {
  const selected = model.selected;
  return (
    <div>
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{selected.town}, Mississippi</p>
      <h1 className="mt-1 font-heading text-4xl tracking-tight text-sea sm:text-5xl">{selected.name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {selected.bedrooms} bedrooms
        {selected.hasGolfCart ? " · Golf cart" : ""}
        {" · "}
        {selected.blurb}
      </p>
      {model.inHouse ? (
        <p className="mt-4 inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full bg-foam px-3 py-1.5 text-sm text-sea">
          <span className="font-medium">In house</span>
          <span>{model.inHouse.guest}</span>
          <span className="text-sea/70">departs {formatStayDate(model.inHouse.departure)}</span>
        </p>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No one is in the house today.</p>
      )}
    </div>
  );
}

function Overview({ model }: { model: DemoModel }) {
  return (
    <>
      <BookingSite />
      <Occupancy model={model} />
      <PayoutSummary model={model} />
      <BookingsCalendar model={model} />
      <div className="flex flex-wrap gap-2">
        <DemoActionButton label="Request an owner block" tone="solid" />
        <DemoActionButton label="Export statement" />
      </div>
      {model.showGolfCart ? <CartCalendar model={model} navigate={false} /> : null}
      <StaySection
        title="Upcoming stays"
        description="Anyone in the house now, and every stay still ahead in this six-month window."
        stays={model.upcoming}
        model={model}
        showMoney={false}
      />
    </>
  );
}

function CalendarSection({ model }: { model: DemoModel }) {
  return (
    <>
      <ChannelFilter model={model} />
      <BookingsCalendar model={model} />
      <DemoActionButton label="Request an owner block" tone="solid" />
      <p className="text-sm text-muted-foreground">
        <Link href={hrefFor(model, { view: "reservations" })} className="font-medium text-sea underline-offset-2 hover:underline">
          Open reservations
        </Link>{" "}
        to see the nightly rate, cleaning fee, and sample owner payout for a stay.
      </p>
    </>
  );
}

function Reservations({ model }: { model: DemoModel }) {
  return (
    <>
      <ChannelFilter model={model} />
      {model.selectedStay ? <StayDetail model={model} stay={model.selectedStay} /> : null}
      <StaySection
        title="Upcoming stays"
        description="Sample stays still ahead, including anyone in the house today."
        stays={model.reservationUpcoming}
        model={model}
        showMoney
      />
      <StaySection
        title="Recent stays"
        description="A sample checkout from earlier this month."
        stays={model.reservationRecent}
        model={model}
        showMoney
      />
      <DemoActionButton label="Request an owner block" tone="solid" />
    </>
  );
}

function Statements({ model }: { model: DemoModel }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl tracking-tight text-sea sm:text-3xl">Statements</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Sample owner payouts by checkout month. Cleaning is listed on its own and is not part of the payout. Pending
            holds are left out of the total.
          </p>
        </div>
        <DemoActionButton label="Export statement" tone="solid" />
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Statement months">
        {model.statements.map((statement) => (
          <Link
            key={statement.month}
            href={hrefFor(model, { statement: statement.month })}
            aria-current={statement.month === model.openStatement?.month ? "page" : undefined}
            className={chipClass(statement.month === model.openStatement?.month)}
          >
            {formatMonthShort(statement.month)}
          </Link>
        ))}
      </div>
      {model.openStatement ? <StatementDetail model={model} /> : null}
    </section>
  );
}

function GolfCart({ model }: { model: DemoModel }) {
  if (!model.showGolfCart) {
    return (
      <section className="rounded-2xl bg-card px-5 py-8 ring-1 ring-foreground/10">
        <h2 className="font-heading text-2xl tracking-tight text-sea sm:text-3xl">Golf cart</h2>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          {model.selected.name} does not include a golf cart. Porch Light Cottage does, and its rentals sit on a second
          calendar beside the bookings.
        </p>
        <Link
          href={demoHref({
            view: "golf-cart",
            unit: "porch-light-cottage",
            month: model.month,
            scope: model.scope === "bayou-breeze-suite" ? "porch-light-cottage" : model.scope,
          })}
          className="mt-4 inline-flex h-8 items-center rounded-lg bg-sea px-2.5 text-sm font-medium text-white hover:bg-sea/90"
        >
          View the Porch Light Cottage cart schedule
        </Link>
      </section>
    );
  }
  return <CartCalendar model={model} navigate />;
}

function BookingSite() {
  return (
    <section className="rounded-2xl bg-card px-5 py-5 ring-1 ring-foreground/10">
      <h2 className="font-heading text-2xl tracking-tight text-sea sm:text-3xl">Book direct</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Guests book Stay with Rain homes on the public booking site. These two homes are fictional, so this preview
        links to the site itself.
      </p>
      <a
        href={DEMO_BOOKING_SITE}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex h-8 items-center rounded-lg bg-sea px-2.5 text-sm font-medium text-white hover:bg-sea/90"
      >
        Stay with Rain booking site
      </a>
    </section>
  );
}

function Occupancy({ model }: { model: DemoModel }) {
  return (
    <>
      <section aria-label="Occupancy" className="grid gap-3 sm:grid-cols-2">
        {model.occupancy.map((item) => (
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
        Occupancy is guest nights divided by the nights in the month. Owner stays are marked on the calendar and left out
        of the percentage.
      </p>
    </>
  );
}

function PayoutSummary({ model }: { model: DemoModel }) {
  const cards = [
    { label: "This month", detail: model.payoutSummary.thisLabel, amount: model.payoutSummary.thisMonth },
    { label: "Next month", detail: model.payoutSummary.nextLabel, amount: model.payoutSummary.nextMonth },
    { label: "On the books", detail: "Sample payout still ahead", amount: model.payoutSummary.onTheBooks },
  ];
  return (
    <section aria-label="Sample payout" className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <article key={card.label} className="rounded-2xl bg-card px-5 py-4 ring-1 ring-foreground/10">
            <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">{card.label}</p>
            <p className="mt-2 font-heading text-4xl tracking-tight text-sea">{formatDemoMoney(card.amount)}</p>
            <p className="mt-1 text-sm">{card.detail}</p>
            <p className="mt-1 text-sm text-muted-foreground">Sample owner payout</p>
          </article>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Sample figures for this preview. Lodging after the channel fee. Direct stays in the sample keep that fee at zero.
      </p>
    </section>
  );
}

function BookingsCalendar({ model }: { model: DemoModel }) {
  const events = stayEvents(model.calendarStays);
  const monthIndex = model.months.indexOf(model.month);
  const prevMonth = monthIndex > 0 ? model.months[monthIndex - 1] : null;
  const nextMonth = monthIndex >= 0 && monthIndex < model.months.length - 1 ? model.months[monthIndex + 1] : null;
  return (
    <MonthCalendar
      title="Bookings"
      description={formatMonth(model.month)}
      month={model.month}
      today={model.today}
      monthLinks={model.months.map((key) => ({
        key,
        href: hrefFor(model, { month: key }),
        label: formatMonthShort(key),
      }))}
      prevHref={prevMonth ? hrefFor(model, { month: prevMonth }) : null}
      nextHref={nextMonth ? hrefFor(model, { month: nextMonth }) : null}
      events={events}
      legend={[
        { tone: "guest", label: "Guest stay" },
        { tone: "owner", label: "Owner stay" },
        ...(events.some((event) => event.tone === "pending") ? [{ tone: "pending" as const, label: "Pending hold" }] : []),
      ]}
      empty="No bookings on this month."
    />
  );
}

function CartCalendar({ model, navigate }: { model: DemoModel; navigate: boolean }) {
  const monthIndex = model.months.indexOf(model.month);
  const prevMonth = monthIndex > 0 ? model.months[monthIndex - 1] : null;
  const nextMonth = monthIndex >= 0 && monthIndex < model.months.length - 1 ? model.months[monthIndex + 1] : null;
  return (
    <MonthCalendar
      title="Golf cart"
      description={`${formatMonth(model.month)} · Golf cart rentals`}
      month={model.month}
      today={model.today}
      monthLinks={
        navigate
          ? model.months.map((key) => ({
              key,
              href: hrefFor(model, { month: key }),
              label: formatMonthShort(key),
            }))
          : undefined
      }
      prevHref={navigate ? (prevMonth ? hrefFor(model, { month: prevMonth }) : null) : undefined}
      nextHref={navigate ? (nextMonth ? hrefFor(model, { month: nextMonth }) : null) : undefined}
      events={model.calendarCarts.map((cart) => ({
        id: cart.id,
        start: cart.start,
        end: cart.end,
        label: cart.label,
        tone: "cart" as const,
      }))}
      legend={[{ tone: "cart", label: "Cart rental" }]}
      empty="No cart rentals this month."
      listEvents
    />
  );
}

function ChannelFilter({ model }: { model: DemoModel }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">Channel</p>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Filter by channel">
        {CHANNELS.map((channel) => (
          <Link
            key={channel}
            href={hrefFor(model, { channel, stay: undefined })}
            aria-current={model.channel === channel ? "page" : undefined}
            className={chipClass(model.channel === channel)}
          >
            {channel === "all" ? "All" : channel}
          </Link>
        ))}
      </div>
    </div>
  );
}

function StaySection({
  title,
  description,
  stays,
  model,
  showMoney,
}: {
  title: string;
  description: string;
  stays: DemoStay[];
  model: DemoModel;
  showMoney: boolean;
}) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl tracking-tight text-sea sm:text-3xl">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <p className="text-sm text-muted-foreground">{stays.length}</p>
      </div>
      {stays.length === 0 ? (
        <div className="rounded-2xl bg-card px-4 py-8 text-sm text-muted-foreground ring-1 ring-foreground/10">
          No sample stays for this view.
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-3 md:hidden">
            {stays.map((stay) => (
              <li key={stay.id}>
                <Link
                  href={stayHref(model, stay.id)}
                  className={cn(
                    "block rounded-2xl bg-card p-4 ring-1 ring-foreground/10",
                    model.selectedStay?.id === stay.id && "bg-foam/60",
                  )}
                >
                  <StaySummary stay={stay} today={model.today} showMoney={showMoney} />
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10 md:block">
            <table className="w-full text-left text-sm">
              <thead className="text-xs tracking-wide text-muted-foreground uppercase">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 font-medium">Guest</th>
                  <th className="px-4 py-3 font-medium">Arrive</th>
                  <th className="px-4 py-3 font-medium">Depart</th>
                  <th className="px-4 py-3 font-medium">Nights</th>
                  <th className="px-4 py-3 font-medium">Channel</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  {showMoney ? <th className="px-4 py-3 font-medium">Owner payout</th> : null}
                </tr>
              </thead>
              <tbody>
                {stays.map((stay) => (
                  <tr
                    key={stay.id}
                    className={cn(
                      "border-b border-border last:border-0",
                      (inHouse(stay, model.today) || model.selectedStay?.id === stay.id) && "bg-foam/60",
                    )}
                  >
                    <td className="px-4 py-3 font-medium">
                      <Link href={stayHref(model, stay.id)} className="underline-offset-2 hover:underline">
                        {stay.guest}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{formatStayDate(stay.arrival)}</td>
                    <td className="px-4 py-3">{formatStayDate(stay.departure)}</td>
                    <td className="px-4 py-3">{stay.nights}</td>
                    <td className="px-4 py-3">{stay.channel}</td>
                    <td className="px-4 py-3">{inHouse(stay, model.today) ? "In house" : stay.statusLabel}</td>
                    {showMoney ? (
                      <td className="px-4 py-3">
                        {stay.tone === "owner" ? "—" : formatDemoMoney(stay.ownerPayout)}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function StaySummary({ stay, today, showMoney }: { stay: DemoStay; today: string; showMoney: boolean }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">{stay.guest}</p>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
          {inHouse(stay, today) ? "In house" : stay.statusLabel}
        </span>
      </div>
      <p className="mt-2 text-sm">
        {formatStayDate(stay.arrival)} – {formatStayDate(stay.departure)}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {stay.nights} {stay.nights === 1 ? "night" : "nights"} · {stay.channel}
        {showMoney && stay.tone !== "owner" ? ` · ${formatDemoMoney(stay.ownerPayout)} sample payout` : ""}
      </p>
    </>
  );
}

function stayHref(model: DemoModel, stayId: string): string {
  return hrefFor(model, {
    view: "reservations",
    stay: model.selectedStay?.id === stayId && model.view === "reservations" ? undefined : stayId,
  });
}

function StayDetail({ model, stay }: { model: DemoModel; stay: DemoStay }) {
  return (
    <article className="rounded-2xl bg-card px-5 py-5 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">Sample stay</p>
          <h2 className="mt-1 font-heading text-3xl tracking-tight text-sea">{stay.guest}</h2>
          <p className="mt-2 text-sm">
            {formatStayDate(stay.arrival)} – {formatStayDate(stay.departure)} · {stay.nights}{" "}
            {stay.nights === 1 ? "night" : "nights"} · {stay.channel}
          </p>
        </div>
        <Link href={hrefFor(model, { stay: undefined })} className="text-sm font-medium text-sea underline-offset-2 hover:underline">
          Close
        </Link>
      </div>
      {stay.tone === "owner" ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Owner block. These nights show on the calendar and stay out of the occupancy percentage and the payout.
        </p>
      ) : (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <MoneyRow label="Nightly rate" value={formatDemoMoney(stay.nightlyRate)} />
          <MoneyRow label="Lodging" value={`${formatDemoMoney(stay.nightlyRate)} × ${stay.nights} = ${formatDemoMoney(stay.lodging)}`} />
          <MoneyRow label="Cleaning fee" value={formatDemoMoney(stay.cleaningFee)} />
          <MoneyRow label="Channel fee" value={stay.channelFee === 0 ? "$0" : formatDemoMoney(stay.channelFee)} />
          <MoneyRow label="Owner payout" value={formatDemoMoney(stay.ownerPayout)} />
        </dl>
      )}
      {stay.tone === "pending" ? (
        <p className="mt-4 text-sm text-muted-foreground">Pending hold. The sample payout is left out of the statement total.</p>
      ) : null}
      {stay.channel === "Direct" && stay.tone !== "owner" ? (
        <p className="mt-4 text-sm text-muted-foreground">Direct stays in this sample have no channel fee.</p>
      ) : null}
    </article>
  );
}

function MoneyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background px-3 py-3">
      <dt className="text-xs tracking-[0.14em] text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}

function StatementDetail({ model }: { model: DemoModel }) {
  const statement = model.openStatement;
  if (!statement) return null;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Guest nights" value={String(statement.guestNights)} />
        <Metric label="Lodging" value={formatDemoMoney(statement.lodging)} />
        <Metric label="Channel fees" value={formatDemoMoney(statement.channelFees)} />
        <Metric label="Owner payout" value={formatDemoMoney(statement.ownerPayout)} />
      </div>
      {statement.lines.length === 0 ? (
        <p className="rounded-2xl bg-card px-4 py-8 text-sm text-muted-foreground ring-1 ring-foreground/10">
          No sample checkouts in {statement.label}.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {statement.lines.map((stay) => (
            <li key={stay.id} className="rounded-2xl bg-card px-4 py-4 ring-1 ring-foreground/10">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{stay.guest}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Checkout {formatStayDate(stay.departure)} · {stay.nights} {stay.nights === 1 ? "night" : "nights"} ·{" "}
                    {stay.channel}
                  </p>
                </div>
                <p className="text-sm font-medium">
                  {stay.tone === "guest" ? formatDemoMoney(stay.ownerPayout) : stay.statusLabel}
                </p>
              </div>
              {stay.tone === "guest" ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatDemoMoney(stay.lodging)} lodging · {formatDemoMoney(stay.cleaningFee)} cleaning ·{" "}
                  {formatDemoMoney(stay.channelFee)} channel fee
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  {stay.tone === "pending" ? "Not included in the payout total." : "Owner block, left out of the payout."}
                </p>
              )}
              <Link
                href={hrefFor(model, { view: "reservations", stay: stay.id })}
                className="mt-2 inline-block text-sm font-medium text-sea underline-offset-2 hover:underline"
              >
                View stay
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl bg-card px-4 py-4 ring-1 ring-foreground/10">
      <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 font-heading text-3xl tracking-tight text-sea">{value}</p>
    </article>
  );
}

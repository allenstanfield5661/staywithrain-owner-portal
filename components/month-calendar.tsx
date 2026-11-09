import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { barsForWeek, type CalendarEvent, type CalendarTone } from "@/lib/calendar-layout";
import { addDays, dayNumber, formatMonth, formatStayDate, formatWeekday, monthGrid } from "@/lib/dates";
import { cn } from "@/lib/utils";

const toneClass: Record<CalendarTone, string> = {
  guest: "bg-sea text-[#f6f3ec]",
  owner: "bg-[#ead7b0] text-[#3f3014]",
  pending: "border border-dashed border-brass bg-[#fbf6ea] text-[#3f3014]",
  cart: "bg-cart text-[#f3faf6]",
};

const swatchClass: Record<CalendarTone, string> = {
  guest: "bg-sea",
  owner: "bg-[#ead7b0] ring-1 ring-[#d7c39a]",
  pending: "border border-dashed border-brass bg-[#fbf6ea]",
  cart: "bg-cart",
};

export function MonthCalendar({
  title,
  description,
  month,
  today,
  monthLinks,
  prevHref,
  nextHref,
  events,
  legend,
  empty,
}: {
  title: string;
  description?: string;
  month: string;
  today: string;
  monthLinks?: { key: string; href: string; label: string }[];
  prevHref?: string | null;
  nextHref?: string | null;
  events: CalendarEvent[];
  legend: { tone: CalendarTone; label: string }[];
  empty: string;
}) {
  const weeks = monthGrid(month);
  const weekday = weeks[0].map((day) => day.iso);

  return (
    <section className="rounded-2xl bg-card p-3 ring-1 ring-foreground/10 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h2 className="font-heading text-2xl tracking-tight text-sea sm:text-3xl">{title}</h2>
          {description ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {prevHref !== undefined ? (
          <div className="flex items-center gap-2">
            {prevHref ? (
              <Link href={prevHref} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-sm hover:bg-muted">
                <ChevronLeft className="size-4" aria-hidden />
                Previous
              </Link>
            ) : (
              <span className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-sm text-muted-foreground/60">
                <ChevronLeft className="size-4" aria-hidden />
                Previous
              </span>
            )}
            {nextHref ? (
              <Link href={nextHref} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-sm hover:bg-muted">
                Next
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            ) : (
              <span className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-sm text-muted-foreground/60">
                Next
                <ChevronRight className="size-4" aria-hidden />
              </span>
            )}
          </div>
        ) : null}
      </div>

      {monthLinks ? (
        <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Months">
          {monthLinks.map((link) => {
            const active = link.key === month;
            return (
              <Link
                key={link.key}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-sm",
                  active ? "bg-sea text-[#f6f3ec]" : "bg-background text-foreground ring-1 ring-border hover:bg-muted",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      ) : null}

      <div className="mt-4" aria-label={`${formatMonth(month)} calendar`}>
        <div className="grid grid-cols-7 px-1 text-center text-[11px] tracking-wide text-muted-foreground uppercase sm:text-xs">
          {weekday.map((iso) => (
            <div key={iso} className="py-2">
              <span className="sm:hidden">{formatWeekday(iso, "narrow")}</span>
              <span className="hidden sm:inline">{formatWeekday(iso)}</span>
            </div>
          ))}
        </div>
        <div className="overflow-hidden rounded-xl border border-border">
          {weeks.map((week, weekIndex) => {
            const bars = barsForWeek(week, events);
            const lanes = Math.max(1, bars.reduce((max, bar) => Math.max(max, bar.lane + 1), 0));
            return (
              <div
                key={week[0].iso}
                className={cn("grid grid-cols-7 gap-y-1 px-1 py-1", weekIndex > 0 && "border-t border-border")}
                style={{ gridTemplateRows: `1.5rem repeat(${lanes}, 1.65rem)` }}
              >
                {week.map((day) => {
                  const isToday = day.iso === today;
                  return (
                    <div key={day.iso} style={{ gridRow: 1 }} className="px-0.5">
                      <span
                        className={cn(
                          "inline-flex size-6 items-center justify-center rounded-full text-xs",
                          isToday && "bg-sea text-[#f6f3ec]",
                          !isToday && day.inMonth && "text-foreground",
                          !day.inMonth && "text-muted-foreground/45",
                        )}
                      >
                        {dayNumber(day.iso)}
                      </span>
                    </div>
                  );
                })}
                {bars.map((bar) => (
                  <div
                    key={`${bar.id}-${weekIndex}-${bar.col}`}
                    style={{ gridColumn: `${bar.col + 1} / span ${bar.span}`, gridRow: bar.lane + 2 }}
                    className={cn(
                      "mx-0.5 flex items-center overflow-hidden rounded-md px-1.5 text-[10px] leading-none sm:text-[11px]",
                      toneClass[bar.tone],
                      !bar.roundStart && "ml-0 rounded-l-none",
                      !bar.roundEnd && "mr-0 rounded-r-none",
                    )}
                    title={bar.label}
                  >
                    <span className="truncate">{bar.label}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs text-muted-foreground">
        {legend.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-sm", swatchClass[item.tone])} aria-hidden />
            {item.label}
          </span>
        ))}
        {events.length === 0 ? <span>{empty}</span> : null}
      </div>
      <ul className="sr-only">
        {events.map((event) => (
          <li key={event.id}>
            {event.label}, {formatStayDate(event.start)} through {formatStayDate(addDays(event.end, -1))}
          </li>
        ))}
      </ul>
    </section>
  );
}

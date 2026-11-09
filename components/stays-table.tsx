import { formatStayDate } from "@/lib/dates";
import type { PublicStay } from "@/lib/stays";
import { cn } from "@/lib/utils";

function pillClass(stay: PublicStay): string {
  if (stay.tone === "owner") return "bg-[#ead7b0] text-[#3f3014]";
  if (stay.tone === "pending") return "bg-[#fbf6ea] text-[#3f3014] ring-1 ring-brass/40";
  if (stay.statusLabel === "Updated") return "bg-foam text-sea";
  return "bg-secondary text-secondary-foreground";
}

export function StaysTable({ stays, today }: { stays: PublicStay[]; today: string }) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl tracking-tight text-sea sm:text-3xl">Upcoming stays</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Anyone in the house now, and every stay still ahead in this six-month window.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">{stays.length}</p>
      </div>
      {stays.length === 0 ? (
        <div className="rounded-2xl bg-card px-4 py-8 text-sm text-muted-foreground ring-1 ring-foreground/10">
          No stays on the books for this window.
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-3 md:hidden">
            {stays.map((stay) => {
              const inHouse = stay.arrival <= today && today < stay.departure;
              return (
                <li key={stay.id} className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{stay.guest}</p>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", pillClass(stay))}>
                      {inHouse ? "In house" : stay.statusLabel}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">
                    {formatStayDate(stay.arrival)} – {formatStayDate(stay.departure)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {stay.nights} {stay.nights === 1 ? "night" : "nights"} · {stay.channel}
                  </p>
                </li>
              );
            })}
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
                </tr>
              </thead>
              <tbody>
                {stays.map((stay) => {
                  const inHouse = stay.arrival <= today && today < stay.departure;
                  return (
                    <tr key={stay.id} className={cn("border-b border-border last:border-0", inHouse && "bg-foam/60")}>
                      <td className="px-4 py-3 font-medium">{stay.guest}</td>
                      <td className="px-4 py-3">{formatStayDate(stay.arrival)}</td>
                      <td className="px-4 py-3">{formatStayDate(stay.departure)}</td>
                      <td className="px-4 py-3">{stay.nights}</td>
                      <td className="px-4 py-3">{stay.channel}</td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", pillClass(stay))}>
                          {inHouse ? "In house" : stay.statusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

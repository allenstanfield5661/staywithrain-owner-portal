import { useMemo, useState, type ReactNode } from "react";
import { listUnits, ownerAccounts } from "@/lib/catalog";
import { barsForWeek, type CalendarEvent } from "@/lib/calendar-layout";
import {
  addDays,
  dayNumber,
  formatMonth,
  formatMonthShort,
  formatStayDate,
  formatTimestamp,
  formatWeekday,
  monthGrid,
} from "@/lib/dates";
import type { PublicStay } from "@/lib/stays";
import {
  PREVIEW_PASSWORD,
  gateOpen,
  loadAssignments,
  loadUser,
  matchAccount,
  openGate,
  portalFor,
  sampleAccounts,
  saveAssignments,
  saveUser,
} from "./sample";

type Screen = "gate" | "login" | "portal" | "admin";

export function App() {
  const [unlocked, setUnlocked] = useState(gateOpen);
  const [user, setUser] = useState(loadUser);
  const [assignments, setAssignments] = useState(loadAssignments);
  const [unitId, setUnitId] = useState<string | undefined>(undefined);
  const [month, setMonth] = useState<string | undefined>(undefined);
  const [screen, setScreen] = useState<Screen>(unlocked ? (user ? "portal" : "login") : "gate");

  const view = useMemo(() => {
    if (!user) return null;
    return portalFor(user, assignments, unitId, month);
  }, [user, assignments, unitId, month]);

  function enterGate(password: string) {
    if (password !== PREVIEW_PASSWORD) return false;
    openGate();
    setUnlocked(true);
    setScreen(user ? "portal" : "login");
    return true;
  }

  function signIn(email: string, password: string) {
    const account = matchAccount(email, password);
    if (!account) return false;
    saveUser(account);
    setUser(account);
    setUnitId(undefined);
    setMonth(undefined);
    setScreen("portal");
    return true;
  }

  function signOut() {
    saveUser(null);
    setUser(null);
    setScreen("login");
  }

  if (screen === "gate" || !unlocked) return <Gate onEnter={enterGate} />;
  if (screen === "login" || !user || !view) return <Login onSignIn={signIn} />;
  if (screen === "admin" && user.role === "admin") {
    return (
      <Shell name={user.name} role="Admin" onCalendars={() => setScreen("portal")} onSignOut={signOut}>
        <Admin
          assignments={assignments}
          month={view.month}
          onOpen={(id) => {
            setUnitId(id);
            setScreen("portal");
          }}
          onSave={(next) => {
            saveAssignments(next);
            setAssignments(next);
          }}
        />
      </Shell>
    );
  }

  return (
    <Shell
      name={user.name}
      role={user.role === "admin" ? "Admin" : "Owner"}
      onManage={user.role === "admin" ? () => setScreen("admin") : undefined}
      onSignOut={signOut}
    >
      <Portal
        view={view}
        onUnit={(id) => setUnitId(id)}
        onMonth={(key) => setMonth(key)}
      />
    </Shell>
  );
}

function Gate({ onEnter }: { onEnter: (password: string) => boolean }) {
  const [error, setError] = useState(false);
  return (
    <main className="gate">
      <section className="sea">
        <p className="serif" style={{ fontSize: "2.6rem", margin: 0 }}>Rain / Stanfield</p>
        <p className="kicker">Private file preview</p>
      </section>
      <section className="panel">
        <form
          className="card-form"
          onSubmit={(event) => {
            event.preventDefault();
            const password = String(new FormData(event.currentTarget).get("password") ?? "");
            setError(!onEnter(password));
          }}
        >
          <h1 className="serif" style={{ fontSize: "2.4rem", color: "var(--sea)", margin: 0 }}>Preview password</h1>
          <p className="muted">This drop only serves files. The password hides the page from a casual visitor. It is not a lock on the files.</p>
          <label htmlFor="preview-password">Password</label>
          <input id="preview-password" name="password" type="password" autoComplete="current-password" required />
          {error ? <p className="alert" role="alert">That password does not open this preview.</p> : null}
          <button className="primary" type="submit">Continue</button>
        </form>
      </section>
    </main>
  );
}

function Login({ onSignIn }: { onSignIn: (email: string, password: string) => boolean }) {
  const [error, setError] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const previews = sampleAccounts().slice().sort((a, b) => Number(a.role === "admin") - Number(b.role === "admin") || a.name.localeCompare(b.name));
  return (
    <main className="login">
      <section className="sea">
        <p className="serif" style={{ fontSize: "3rem", margin: "2rem 0 0" }}>Rain / Stanfield</p>
        <p className="kicker">Gulf Coast Mississippi</p>
        <p style={{ maxWidth: "22rem", fontSize: "1.1rem" }}>Eight houses. Each owner sees only their own calendar.</p>
      </section>
      <section className="panel">
        <form
          className="card-form"
          onSubmit={(event) => {
            event.preventDefault();
            setError(!onSignIn(email, password));
          }}
        >
          <h1 className="serif" style={{ fontSize: "2.4rem", color: "var(--sea)", margin: 0 }}>Sign in</h1>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          {error ? <p className="alert" role="alert">That email and password do not match a portal account.</p> : null}
          <button className="primary" type="submit">Sign in</button>
          <div>
            <p style={{ marginBottom: "0.4rem" }}><strong>Preview sign-in</strong></p>
            <p className="muted">Fictional accounts. Not real owners.</p>
            <div className="accounts">
              {previews.map((account) => (
                <div className="account" key={account.email}>
                  <span>
                    <strong>{account.role === "admin" ? `${account.name} · admin` : account.name}</strong>
                    <span className="muted" style={{ display: "block" }}>{account.email}</span>
                  </span>
                  <button
                    className="ghost"
                    type="button"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(account.password);
                      setError(false);
                    }}
                  >
                    Use
                  </button>
                </div>
              ))}
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}

function Shell({
  name,
  role,
  onSignOut,
  onManage,
  onCalendars,
  children,
}: {
  name: string;
  role: string;
  onSignOut: () => void;
  onManage?: () => void;
  onCalendars?: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <header className="header">
        <div className="header-inner">
          <div>
            <p className="serif" style={{ fontSize: "2rem", margin: 0 }}>Rain / Stanfield</p>
            <p className="kicker">Owner portal · Gulf Coast Mississippi</p>
          </div>
          <p style={{ textAlign: "right", fontSize: "0.85rem" }}>
            <span className="kicker">Last updated</span><br />
            <time>{formatTimestamp(new Date().toISOString())}</time>
          </p>
        </div>
      </header>
      <div className="rule" />
      <div className="banner"><p className="wrap" style={{ paddingTop: "0.55rem", paddingBottom: "0.55rem" }}>Sample calendar for this static preview. Guest names are fictional.</p></div>
      <div className="bar">
        <p style={{ margin: 0 }}>{name} · {role}</p>
        <span style={{ display: "flex", gap: "0.4rem" }}>
          {onManage ? <button className="ghost" type="button" onClick={onManage}>Manage owners</button> : null}
          {onCalendars ? <button className="ghost" type="button" onClick={onCalendars}>Calendars</button> : null}
          <button className="ghost" type="button" onClick={onSignOut}>Sign out</button>
        </span>
      </div>
      <main className="wrap">{children}</main>
    </div>
  );
}

function Portal({
  view,
  onUnit,
  onMonth,
}: {
  view: NonNullable<ReturnType<typeof portalFor>>;
  onUnit: (id: string) => void;
  onMonth: (month: string) => void;
}) {
  const selected = view.selected;
  if (!selected) {
    return <section className="sheet" style={{ padding: "1.2rem" }}><h1>No units on this login</h1></section>;
  }
  const monthIndex = view.months.indexOf(view.month);
  return (
    <>
      {view.units.length > 1 ? (
        <nav className="chips" aria-label="Your units">
          {view.units.map((unit) => (
            <button key={unit.id} className={unit.id === selected.id ? "chip on" : "chip"} type="button" onClick={() => onUnit(unit.id)}>
              {unit.name}
            </button>
          ))}
        </nav>
      ) : null}
      <div>
        <p className="kicker" style={{ color: "var(--muted)" }}>{selected.town}, Mississippi</p>
        <h1 className="serif" style={{ fontSize: "2.7rem", color: "var(--sea)", margin: "0.2rem 0" }}>{selected.name}</h1>
        <p className="muted">{selected.bedrooms} bedrooms{selected.hasGolfCart ? ` · Golf cart ${selected.tags.join(" and ")}` : ""}</p>
        {view.inHouse ? (
          <p className="pill">In house {view.inHouse.guest} departs {formatStayDate(view.inHouse.departure)}</p>
        ) : <p className="muted">No one is in the house today.</p>}
      </div>
      <section className="stats" aria-label="Occupancy">
        {view.occupancy.map((item) => (
          <article className="stat" key={item.when}>
            <p className="kicker" style={{ color: "var(--muted)" }}>{item.when}</p>
            <strong>{item.percent}%</strong>
            <p>{item.label}</p>
            <p className="muted">{item.guestNights} of {item.total} nights booked{item.ownerNights ? ` · ${item.ownerNights} owner-blocked nights not included` : ""}</p>
          </article>
        ))}
      </section>
      <MonthSheet
        title="Bookings"
        month={view.month}
        today={view.today}
        events={view.calendarStays.map((stay) => ({
          id: stay.id,
          start: stay.arrival,
          end: stay.departure,
          label: stay.tone === "owner" ? "Owner" : stay.guest,
          tone: stay.tone,
        }))}
        months={view.months}
        onMonth={onMonth}
        onPrev={monthIndex > 0 ? () => onMonth(view.months[monthIndex - 1]) : undefined}
        onNext={monthIndex < view.months.length - 1 ? () => onMonth(view.months[monthIndex + 1]) : undefined}
        empty="No bookings on this month."
      />
      {selected.hasGolfCart ? (
        <MonthSheet
          title="Golf cart"
          description={`${formatMonth(view.month)} · STR Golf Cart Rentals · tags ${selected.tags.join(" and ")}`}
          month={view.month}
          today={view.today}
          events={view.calendarCarts.map((cart) => ({
            id: cart.id,
            start: cart.start,
            end: cart.end,
            label: cart.label,
            tone: "cart" as const,
          }))}
          empty="No cart rentals this month."
        />
      ) : null}
      <Stays stays={view.upcoming} today={view.today} />
      <p className="footer">Guest names are a first name and last initial. Payments, contact details, and notes are not in this preview. Rain / Stanfield · Mississippi Gulf Coast</p>
    </>
  );
}

function MonthSheet({
  title,
  description,
  month,
  today,
  events,
  months,
  onMonth,
  onPrev,
  onNext,
  empty,
}: {
  title: string;
  description?: string;
  month: string;
  today: string;
  events: CalendarEvent[];
  months?: string[];
  onMonth?: (month: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  empty: string;
}) {
  const weeks = monthGrid(month);
  return (
    <section className="sheet calendar">
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem", flexWrap: "wrap" }}>
        <div>
          <h2 className="serif" style={{ color: "var(--sea)", margin: 0 }}>{title}</h2>
          <p className="muted">{description ?? formatMonth(month)}</p>
        </div>
        {onMonth ? (
          <span>
            <button className="ghost" type="button" disabled={!onPrev} onClick={onPrev}>Previous</button>{" "}
            <button className="ghost" type="button" disabled={!onNext} onClick={onNext}>Next</button>
          </span>
        ) : null}
      </div>
      {months && onMonth ? (
        <div className="chips" style={{ margin: "0.6rem 0" }}>
          {months.map((key) => (
            <button key={key} className={key === month ? "chip on" : "chip"} type="button" onClick={() => onMonth(key)}>
              {formatMonthShort(key)}
            </button>
          ))}
        </div>
      ) : null}
      <div className="dow">
        {weeks[0].map((day) => <div key={day.iso}>{formatWeekday(day.iso, "narrow")}</div>)}
      </div>
      {weeks.map((week, weekIndex) => {
        const bars = barsForWeek(week, events);
        const lanes = Math.max(1, bars.reduce((max, bar) => Math.max(max, bar.lane + 1), 0));
        return (
          <div
            className="week"
            key={week[0].iso}
            style={{ gridTemplateRows: `1.4rem repeat(${lanes}, 1.4rem)` }}
          >
            {week.map((day) => (
              <div key={day.iso} className={day.iso === today ? "daynum today" : day.inMonth ? "daynum" : "daynum off"} style={{ gridRow: 1 }}>
                <span>{dayNumber(day.iso)}</span>
              </div>
            ))}
            {bars.map((bar) => (
              <div
                key={`${bar.id}-${weekIndex}-${bar.col}`}
                className={`barstay ${bar.tone}`}
                style={{ gridColumn: `${bar.col + 1} / span ${bar.span}`, gridRow: bar.lane + 2 }}
                title={bar.label}
              >
                {bar.label}
              </div>
            ))}
          </div>
        );
      })}
      {events.length === 0 ? <p className="muted">{empty}</p> : null}
      <ul className="sr-only">
        {events.map((event) => (
          <li key={event.id}>{event.label}, {formatStayDate(event.start)} through {formatStayDate(addDays(event.end, -1))}</li>
        ))}
      </ul>
    </section>
  );
}

function Stays({ stays, today }: { stays: PublicStay[]; today: string }) {
  return (
    <section>
      <h2 className="serif" style={{ color: "var(--sea)" }}>Upcoming stays</h2>
      {stays.length === 0 ? <p className="sheet" style={{ padding: "1rem" }}>No stays on the books for this window.</p> : (
        <>
          <div className="cards mobile">
            {stays.map((stay) => (
              <article className="sheet staycard" key={stay.id}>
                <strong>{stay.guest}</strong>
                <p>{formatStayDate(stay.arrival)} – {formatStayDate(stay.departure)}</p>
                <p className="muted">{stay.nights} nights · {stay.channel} · {stay.arrival <= today && today < stay.departure ? "In house" : stay.statusLabel}</p>
              </article>
            ))}
          </div>
          <div className="sheet desktop">
            <table>
              <thead>
                <tr><th>Guest</th><th>Arrive</th><th>Depart</th><th>Nights</th><th>Channel</th><th>Status</th></tr>
              </thead>
              <tbody>
                {stays.map((stay) => (
                  <tr key={stay.id}>
                    <td>{stay.guest}</td>
                    <td>{formatStayDate(stay.arrival)}</td>
                    <td>{formatStayDate(stay.departure)}</td>
                    <td>{stay.nights}</td>
                    <td>{stay.channel}</td>
                    <td>{stay.arrival <= today && today < stay.departure ? "In house" : stay.statusLabel}</td>
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

function Admin({
  assignments,
  month,
  onSave,
  onOpen,
}: {
  assignments: Record<string, string | null>;
  month: string;
  onSave: (next: Record<string, string | null>) => void;
  onOpen: (unitId: string) => void;
}) {
  const owners = ownerAccounts();
  const [draft, setDraft] = useState(assignments);
  const [saved, setSaved] = useState(false);
  return (
    <section>
      <h1 className="serif" style={{ color: "var(--sea)", fontSize: "2.4rem" }}>Owners and units</h1>
      <p className="muted">Changes stay in this browser. The seeded owners are what a new visit sees.</p>
      <div className="cards">
        {listUnits().map((unit) => (
          <div className="sheet unitrow" key={unit.id}>
            <div>
              <button className="ghost" type="button" onClick={() => onOpen(unit.id)}>{unit.name}</button>
              <p className="muted">{unit.town} · {unit.bedrooms} bedrooms</p>
            </div>
            <select
              aria-label={`Owner for ${unit.name}`}
              value={draft[unit.id] ?? "unassigned"}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, [unit.id]: value === "unassigned" ? null : value }));
                setSaved(false);
              }}
            >
              <option value="unassigned">Unassigned</option>
              {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
            </select>
          </div>
        ))}
      </div>
      <p>
        <button className="primary" type="button" onClick={() => { onSave(draft); setSaved(true); }}>Save in this browser</button>
        {saved ? <span className="muted"> Saved on this device.</span> : null}
      </p>
      <p className="muted">Showing {month}.</p>
    </section>
  );
}


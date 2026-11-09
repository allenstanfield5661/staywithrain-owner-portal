import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import type { PublicAccount } from "@/lib/catalog";
import { formatTimestamp } from "@/lib/dates";

export function PortalShell({
  account,
  fetchedAt,
  source,
  mode,
  children,
}: {
  account: PublicAccount;
  fetchedAt: string;
  source: "mock" | "live";
  mode: "portal" | "admin";
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <a
        href="#portal-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="bg-sea text-[#f6f3ec]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-x-6 gap-y-3 px-4 py-5 sm:px-6">
          <div>
            <p className="font-heading text-[1.7rem] leading-none tracking-tight sm:text-4xl">Rain / Stanfield</p>
            <p className="mt-2 text-[11px] tracking-[0.16em] text-white/75 uppercase">
              Owner portal · Gulf Coast Mississippi
            </p>
          </div>
          <p className="text-right text-xs leading-5 text-white/80 sm:text-sm">
            <span className="block text-[11px] tracking-[0.14em] text-white/55 uppercase">Last updated</span>
            <time dateTime={fetchedAt}>{formatTimestamp(fetchedAt)}</time>
          </p>
        </div>
      </header>
      <div className="h-1 bg-brass" />
      {source === "mock" ? (
        <div className="bg-brass-soft text-[#3f3014]">
          <p className="mx-auto max-w-6xl px-4 py-2 text-sm sm:px-6">
            Sample calendar for this preview. Guest names are fictional.
          </p>
        </div>
      ) : null}
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p className="text-sm">
            <span className="font-medium">{account.name}</span>
            <span className="text-muted-foreground"> · {account.role === "admin" ? "Admin" : "Owner"}</span>
          </p>
          <div className="flex items-center gap-2">
            {account.role === "admin" && mode === "portal" ? (
              <Link
                href="/admin"
                className="inline-flex h-8 items-center rounded-lg border border-border bg-card px-2.5 text-sm font-medium hover:bg-muted"
              >
                Manage owners
              </Link>
            ) : null}
            {mode === "admin" ? (
              <Link
                href="/portal"
                className="inline-flex h-8 items-center rounded-lg border border-border bg-card px-2.5 text-sm font-medium hover:bg-muted"
              >
                Calendars
              </Link>
            ) : null}
            <SignOutButton />
          </div>
        </div>
      </div>
      <main id="portal-main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}

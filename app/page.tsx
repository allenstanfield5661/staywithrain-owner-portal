import { Suspense } from "react";
import { io } from "next/cache";
import { BrandMark } from "@/components/brand-mark";
import { LoginForm, type PreviewLogin } from "@/components/login-form";
import { listAccounts } from "@/lib/catalog";
import { dataMode } from "@/lib/data-mode";

export default function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ password?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<main className="min-h-screen bg-background" />}>
      <LoginScreen searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginScreen({ searchParams }: { searchParams: Promise<{ password?: string | string[] }> }) {
  await io();
  const params = await searchParams;
  const saved = (Array.isArray(params.password) ? params.password[0] : params.password) === "saved";
  const previews: PreviewLogin[] =
    dataMode() === "live"
      ? []
      : listAccounts()
    .slice()
    .sort((a, b) => Number(a.role === "admin") - Number(b.role === "admin") || a.name.localeCompare(b.name))
    .map((account) => ({
      name: account.role === "admin" ? `${account.name} · admin` : account.name,
      email: account.email,
      password: account.password,
    }));

  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <section className="relative overflow-hidden bg-sea px-6 py-12 text-white sm:px-10 lg:flex lg:flex-col lg:justify-end lg:px-12 lg:py-16">
        <img
          src="/brand/starburst_web_faded.png"
          alt=""
          className="pointer-events-none absolute -right-24 -bottom-16 w-[34rem] max-w-none select-none"
        />
        <div className="relative max-w-md">
          <p className="text-xs font-medium tracking-[0.2em] text-white/75 uppercase">Owner portal</p>
          <h1 className="mt-8">
            <BrandMark variant="white-lockup" priority className="h-auto w-full max-w-sm" />
          </h1>
          <p className="mt-8 max-w-xs text-base leading-relaxed text-white/85">
            Your calendars, upcoming stays, and occupancy, for the houses assigned to you.
          </p>
        </div>
      </section>
      <section className="flex items-center bg-background px-6 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <h2 className="font-heading text-4xl font-semibold tracking-tight text-sea">Sign in</h2>
          <p className="mt-2 mb-6 text-sm text-muted-foreground">
            Use the email and password on your owner account.
          </p>
          {saved ? <p className="mb-4 text-sm text-sea">Password saved. Sign in with it.</p> : null}
          <LoginForm previews={previews} />
        </div>
      </section>
    </main>
  );
}

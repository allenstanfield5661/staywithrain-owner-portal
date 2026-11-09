import { Suspense } from "react";
import { io } from "next/cache";
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
      <section className="bg-sea px-6 py-10 text-[#f6f3ec] sm:px-10 lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-14">
        <div>
          <p className="inline-flex size-12 items-center justify-center rounded-full border border-white/30 font-heading text-sm">
            R/S
          </p>
          <h1 className="mt-8 font-heading text-5xl leading-[0.95] tracking-tight sm:text-6xl">Rain / Stanfield</h1>
          <p className="mt-4 text-sm tracking-[0.16em] text-white/70 uppercase">Gulf Coast Mississippi</p>
        </div>
        <p className="mt-10 max-w-sm text-lg leading-relaxed text-white/85 lg:mt-0">
          Eight houses. Each owner sees only their own calendar, upcoming stays, and occupancy.
        </p>
      </section>
      <section className="flex items-center px-6 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <h2 className="font-heading text-4xl tracking-tight text-sea">Sign in</h2>
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

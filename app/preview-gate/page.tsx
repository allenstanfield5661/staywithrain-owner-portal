import { Suspense } from "react";
import { BrandMark } from "@/components/brand-mark";

export default function PreviewGatePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<main className="min-h-screen bg-background" />}>
      <Gate searchParams={searchParams} />
    </Suspense>
  );
}

async function Gate({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative overflow-hidden bg-sea px-6 py-12 text-white sm:px-10">
        <img
          src="/brand/starburst_web_faded.png"
          alt=""
          className="pointer-events-none absolute -right-16 -bottom-10 w-[24rem] max-w-none select-none"
        />
        <div className="relative max-w-sm">
          <p className="text-xs font-medium tracking-[0.2em] text-white/75 uppercase">Private preview</p>
          <BrandMark variant="white-lockup" className="mt-8 h-auto w-full" />
        </div>
      </section>
      <section className="flex items-center px-6 py-12 sm:px-10">
        <form action="/api/preview-gate" method="post" className="mx-auto flex w-full max-w-sm flex-col gap-4">
          <h1 className="font-heading text-4xl tracking-tight text-sea">Preview password</h1>
          <p className="text-sm text-muted-foreground">
            This site is closed. The owner login is on the next page.
          </p>
          <div className="flex flex-col gap-2">
            <label htmlFor="preview-password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="preview-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="h-11 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          {error ? (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              That password does not open this preview.
            </p>
          ) : null}
          <button type="submit" className="h-11 rounded-lg bg-primary text-sm font-medium text-primary-foreground">
            Continue
          </button>
        </form>
      </section>
    </main>
  );
}

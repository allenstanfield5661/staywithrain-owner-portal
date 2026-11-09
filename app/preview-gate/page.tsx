import { Suspense } from "react";

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
      <section className="bg-sea px-6 py-12 text-[#f6f3ec] sm:px-10">
        <p className="font-heading text-4xl tracking-tight">Rain / Stanfield</p>
        <p className="mt-3 text-sm tracking-[0.16em] text-white/70 uppercase">Private preview</p>
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

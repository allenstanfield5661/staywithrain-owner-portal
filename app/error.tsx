"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Rain / Stanfield</p>
      <h1 className="mt-2 font-heading text-4xl tracking-tight text-sea">This page did not load</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        The portal hit an unexpected error. Your booking data was not changed.
      </p>
      <Button type="button" className="mt-6 w-fit" onClick={() => reset()}>
        Try again
      </Button>
    </main>
  );
}

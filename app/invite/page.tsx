import { Suspense } from "react";
import { SetPasswordForm } from "@/components/set-password-form";

export default function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<main className="min-h-screen bg-background" />}>
      <Invite searchParams={searchParams} />
    </Suspense>
  );
}

async function Invite({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Rain / Stanfield</p>
      <h1 className="mt-2 font-heading text-4xl tracking-tight text-sea">Set your password</h1>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">Choose a password for your owner login. This link expires in 7 days.</p>
      {token ? <SetPasswordForm token={token} /> : <p className="text-sm text-destructive">This invite link is missing a token.</p>}
    </main>
  );
}

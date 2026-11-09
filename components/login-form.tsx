"use client";

import { useActionState } from "react";
import { loginAction, loginWithForm, type ActionState } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type PreviewLogin = {
  name: string;
  email: string;
  password: string;
};

const initialState: ActionState = { error: "" };

export function LoginForm({ previews }: { previews: PreviewLogin[] }) {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <div className="flex flex-col gap-8">
      <form action={action} autoComplete="off" className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="off"
            required
            placeholder="you@example.com"
            className="h-11 bg-card"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="off"
            required
            className="h-11 bg-card"
          />
        </div>
        {state.error ? (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="mt-1 h-11 w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {previews.length > 0 ? <div className="rounded-xl bg-brass-soft/70 p-4 ring-1 ring-brass/15">
        <p className="text-sm font-medium text-[#3f3014]">Preview sign-in</p>
        <p className="mt-1 text-sm text-[#5c4a30]">
          These are fictional accounts so the preview runs without secrets. They are not real owners.
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {previews.map((preview) => (
            <li key={preview.email} className="flex items-center justify-between gap-3 rounded-lg bg-card px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{preview.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {preview.email} · {preview.password}
                </span>
              </span>
              <form action={loginWithForm}>
                <input type="hidden" name="email" value={preview.email} />
                <input type="hidden" name="password" value={preview.password} />
                <Button type="submit" variant="outline" size="sm" className="shrink-0 bg-card">
                  Use
                </Button>
              </form>
            </li>
          ))}
        </ul>
      </div> : null}
    </div>
  );
}

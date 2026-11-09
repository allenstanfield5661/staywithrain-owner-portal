"use client";

import { useActionState } from "react";
import { setPasswordAction, type ActionState } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ActionState = { error: "" };

export function SetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(setPasswordAction, initialState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required className="h-11 bg-card" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="h-11 bg-card" />
      </div>
      {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" className="h-11" disabled={pending}>{pending ? "Saving…" : "Save password"}</Button>
    </form>
  );
}

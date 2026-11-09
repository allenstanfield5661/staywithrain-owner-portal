"use client";

import { logoutAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="outline" size="sm" className="bg-card">
        Sign out
      </Button>
    </form>
  );
}

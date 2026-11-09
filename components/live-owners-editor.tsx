"use client";

import { useState } from "react";
import { createInviteAction, saveOwnersAction, type ActionState } from "@/lib/actions";
import type { PublicOwner } from "@/lib/owner-store";
import { Button } from "@/components/ui/button";

type Listing = { id: string; name: string; town: string };

export function LiveOwnersEditor({ owners, listings }: { owners: PublicOwner[]; listings: Listing[] }) {
  const [draft, setDraft] = useState(owners);
  const [status, setStatus] = useState<ActionState>({ error: "" });
  const [pending, setPending] = useState(false);

  function addOwner() {
    const stamp = Date.now().toString(36);
    setDraft((current) => [
      ...current,
      { id: `owner-new-${stamp}`, name: "", email: "", listingIds: [], hasPassword: false },
    ]);
  }

  async function save() {
    setPending(true);
    const form = new FormData();
    form.set(
      "owners",
      JSON.stringify(draft.map((owner) => ({ id: owner.id, name: owner.name, email: owner.email, listingIds: owner.listingIds }))),
    );
    const result = await saveOwnersAction({ error: "" }, form);
    setStatus(result);
    setPending(false);
  }

  async function invite(ownerId: string) {
    setPending(true);
    const result = await createInviteAction(ownerId);
    setStatus(result);
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-3">
      {draft.map((owner) => (
        <article key={owner.id} className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Name
              <input
                className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-2.5"
                value={owner.name}
                onChange={(event) =>
                  setDraft((current) => current.map((item) => (item.id === owner.id ? { ...item, name: event.target.value } : item)))
                }
              />
            </label>
            <label className="text-sm">
              Email
              <input
                className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-2.5"
                value={owner.email}
                onChange={(event) =>
                  setDraft((current) => current.map((item) => (item.id === owner.id ? { ...item, email: event.target.value } : item)))
                }
              />
            </label>
          </div>
          <fieldset className="mt-3">
            <legend className="text-sm font-medium">Listings</legend>
            <div className="mt-2 flex flex-col gap-1">
              {listings.map((listing) => (
                <label key={listing.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={owner.listingIds.includes(listing.id)}
                    onChange={(event) => {
                      setDraft((current) =>
                        current.map((item) => {
                          const without = item.listingIds.filter((id) => id !== listing.id);
                          if (item.id !== owner.id) return { ...item, listingIds: without };
                          return { ...item, listingIds: event.target.checked ? [...without, listing.id] : without };
                        }),
                      );
                    }}
                  />
                  {listing.name}
                  <span className="text-muted-foreground">{listing.town}</span>
                </label>
              ))}
              {listings.length === 0 ? <p className="text-sm text-muted-foreground">Hostaway has not returned listings yet.</p> : null}
            </div>
          </fieldset>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={pending || owner.id.startsWith("owner-new-")} onClick={() => invite(owner.id)}>
              Create invite link
            </Button>
            <span className="text-xs text-muted-foreground">{owner.hasPassword ? "Password set" : "No password yet"}</span>
          </div>
        </article>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={addOwner}>Add owner</Button>
        <Button type="button" disabled={pending} onClick={() => void save()}>{pending ? "Saving…" : "Save owners"}</Button>
      </div>
      {status.error ? <p role="alert" className="text-sm text-destructive">{status.error}</p> : null}
      {status.saved ? <p className="text-sm text-muted-foreground">Saved.</p> : null}
      {status.inviteUrl ? (
        <label className="text-sm">
          Invite link. Send this to the owner. It expires in 7 days.
          <input className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-2.5" readOnly value={status.inviteUrl} />
        </label>
      ) : null}
    </div>
  );
}

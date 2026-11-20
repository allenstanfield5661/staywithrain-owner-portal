"use client";

import { useState } from "react";
import { createInviteAction, saveOwnersAction, type ActionState } from "@/lib/actions";
import { duplicateOwnerEmailMessage, normalizeOwnerEmail } from "@/lib/owner-rules";
import type { PublicOwner } from "@/lib/owner-store";
import { Button } from "@/components/ui/button";

type Listing = { id: string; name: string; town: string };

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function listingChoices(listings: Listing[], owners: PublicOwner[]): Listing[] {
  const known = new Set(listings.map((listing) => listing.id));
  const extras = [...new Set(owners.flatMap((owner) => owner.listingIds))].filter((id) => !known.has(id));
  return [
    ...listings,
    ...extras.map((id) => ({ id, name: `Listing ${id}`, town: "Not in the current catalog" })),
  ];
}

function accessSummary(owner: PublicOwner, listings: Listing[]): string {
  if (owner.listingIds.length === 0) return "This login has no listings yet.";
  const names = owner.listingIds.map((id) => listings.find((listing) => listing.id === id)?.name ?? `Listing ${id}`);
  return `This login can access ${joinNames(names)}.`;
}

export function LiveOwnersEditor({ owners, listings }: { owners: PublicOwner[]; listings: Listing[] }) {
  const [draft, setDraft] = useState(owners);
  const [status, setStatus] = useState<ActionState>({ error: "" });
  const [pending, setPending] = useState(false);
  const choices = listingChoices(listings, draft);
  const emailCounts = new Map<string, number>();
  for (const owner of draft) {
    const email = normalizeOwnerEmail(owner.email);
    if (!email) continue;
    emailCounts.set(email, (emailCounts.get(email) ?? 0) + 1);
  }

  function addOwner() {
    const id = `owner-new-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    setDraft((current) => [
      ...current,
      { id, name: "", email: "", listingIds: [], hasPassword: false },
    ]);
    setStatus({ error: "" });
  }

  function updateOwner(ownerId: string, patch: Partial<Pick<PublicOwner, "name" | "email">>) {
    setDraft((current) => current.map((item) => (item.id === ownerId ? { ...item, ...patch } : item)));
    setStatus({ error: "" });
  }

  function toggleListing(ownerId: string, listingId: string, checked: boolean) {
    setDraft((current) =>
      current.map((item) => {
        if (item.id !== ownerId) return item;
        const without = item.listingIds.filter((id) => id !== listingId);
        return { ...item, listingIds: checked ? [...without, listingId] : without };
      }),
    );
    setStatus({ error: "" });
  }

  async function save() {
    const missing = draft.find((owner) => !owner.name.trim() || !normalizeOwnerEmail(owner.email).includes("@"));
    if (missing) {
      setStatus({ error: "Each owner needs a name and email." });
      return;
    }
    const duplicate = draft.map((owner) => normalizeOwnerEmail(owner.email)).find((email, index, emails) => emails.indexOf(email) !== index);
    if (duplicate) {
      setStatus({ error: duplicateOwnerEmailMessage(duplicate) });
      return;
    }
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
      <p className="max-w-2xl text-sm text-muted-foreground">
        Check a listing on every login that should see it. Saving does not take a house off someone else&apos;s account.
      </p>
      {draft.length === 0 ? (
        <p className="rounded-2xl bg-card px-4 py-5 text-sm text-muted-foreground ring-1 ring-foreground/10">
          No owner logins yet. Add one email for each person who signs in separately.
        </p>
      ) : null}
      {draft.map((owner) => {
        const email = normalizeOwnerEmail(owner.email);
        const duplicate = Boolean(email) && (emailCounts.get(email) ?? 0) > 1;
        const sharedNames = (listingId: string) =>
          draft
            .filter((item) => item.id !== owner.id && item.listingIds.includes(listingId))
            .map((item) => item.name.trim() || item.email.trim() || "another login");
        return (
          <article key={owner.id} className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="font-heading text-2xl tracking-tight text-sea">Owner login</h2>
              <Button type="button" variant="outline" size="sm" onClick={() => setDraft((current) => current.filter((item) => item.id !== owner.id))}>
                Remove login
              </Button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Name
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-2.5"
                  value={owner.name}
                  placeholder="Name on the house"
                  onChange={(event) => updateOwner(owner.id, { name: event.target.value })}
                />
                <span className="mt-1 block text-xs text-muted-foreground">
                  Keep both names here when they share this email.
                </span>
              </label>
              <label className="text-sm">
                Email
                <input
                  className={`mt-1 h-10 w-full rounded-lg border bg-background px-2.5 ${duplicate ? "border-destructive" : "border-input"}`}
                  type="email"
                  value={owner.email}
                  autoComplete="off"
                  aria-invalid={duplicate}
                  onChange={(event) => updateOwner(owner.id, { email: event.target.value })}
                />
                <span className="mt-1 block text-xs text-muted-foreground">This email is the login. A shared mailbox stays one account.</span>
                {duplicate ? (
                  <span role="alert" className="mt-1 block text-xs text-destructive">
                    This email is already used. One email is one login.
                  </span>
                ) : null}
              </label>
            </div>
            <p className="mt-3 text-sm text-foreground">{accessSummary(owner, choices)}</p>
            <fieldset className="mt-3">
              <legend className="text-sm font-medium">Listings this login can access</legend>
              <div className="mt-2 flex flex-col gap-1.5">
                {choices.map((listing) => {
                  const others = sharedNames(listing.id);
                  return (
                    <label key={listing.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={owner.listingIds.includes(listing.id)}
                        onChange={(event) => toggleListing(owner.id, listing.id, event.target.checked)}
                      />
                      <span>{listing.name}</span>
                      <span className="text-muted-foreground">{listing.town}</span>
                      {others.length > 0 ? (
                        <span className="rounded-full bg-brass-soft px-2 py-0.5 text-xs text-foreground">
                          Shared with {joinNames(others)}
                        </span>
                      ) : null}
                    </label>
                  );
                })}
                {choices.length === 0 ? <p className="text-sm text-muted-foreground">Hostaway has not returned listings yet.</p> : null}
              </div>
            </fieldset>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" disabled={pending || owner.id.startsWith("owner-new-") || duplicate} onClick={() => invite(owner.id)}>
                Create invite link
              </Button>
              <span className="text-xs text-muted-foreground">{owner.hasPassword ? "Password set" : "No password yet"}</span>
            </div>
          </article>
        );
      })}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={addOwner}>Add login</Button>
        <Button type="button" disabled={pending} onClick={() => void save()}>{pending ? "Saving…" : "Save owners"}</Button>
      </div>
      {status.error ? <p role="alert" className="text-sm text-destructive">{status.error}</p> : null}
      {status.saved ? <p className="text-sm text-muted-foreground">Saved. Each email still has its own password.</p> : null}
      {status.inviteUrl ? (
        <label className="text-sm">
          Invite link. Send this to the owner. It expires in 7 days.
          <input className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-2.5" readOnly value={status.inviteUrl} />
        </label>
      ) : null}
    </div>
  );
}

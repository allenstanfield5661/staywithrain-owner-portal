"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { saveAssignmentsAction, type ActionState } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { portalHref } from "@/lib/view";

type OwnerOption = { id: string; name: string; email: string };
type UnitOption = { id: string; name: string; town: string; bedrooms: number };

const initialState: ActionState = { error: "" };

export function AssignmentEditor({
  units,
  owners,
  assignments,
  month,
}: {
  units: UnitOption[];
  owners: OwnerOption[];
  assignments: Record<string, string | null>;
  month: string;
}) {
  const items = [
    { value: "unassigned", label: "Unassigned" },
    ...owners.map((owner) => ({ value: owner.id, label: owner.name })),
  ];
  const starting = Object.fromEntries(units.map((unit) => [unit.id, assignments[unit.id] ?? "unassigned"]));
  const [draft, setDraft] = useState<Record<string, string>>(starting);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(starting));
  const [state, setState] = useState<ActionState>(initialState);
  const [pending, setPending] = useState(false);
  const dirty = JSON.stringify(draft) !== savedJson;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setState(initialState);
    const result = await saveAssignmentsAction(initialState, new FormData(event.currentTarget));
    setPending(false);
    setState(result);
    if (result.saved) setSavedJson(JSON.stringify(draft));
  }

  const counts = new Map<string, number>();
  for (const ownerId of Object.values(draft)) {
    if (ownerId === "unassigned") continue;
    counts.set(ownerId, (counts.get(ownerId) ?? 0) + 1);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="font-heading text-2xl tracking-tight text-sea">Owners</h2>
        <ul className="mt-3 flex flex-col gap-3">
          {owners.map((owner) => {
            const count = counts.get(owner.id) ?? 0;
            return (
              <li key={owner.id}>
                <p className="font-medium">{owner.name}</p>
                <p className="text-xs break-all text-muted-foreground">{owner.email}</p>
                <p className="text-xs text-muted-foreground">
                  {count} {count === 1 ? "unit" : "units"}
                </p>
              </li>
            );
          })}
        </ul>
      </aside>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <ul className="flex flex-col gap-3 pb-28">
          {units.map((unit) => (
            <li key={unit.id} className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-heading text-xl tracking-tight">{unit.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {unit.town} · {unit.bedrooms} bedrooms
                  </p>
                  <Link href={portalHref(unit.id, month)} className="text-sm text-sea underline-offset-4 hover:underline">
                    Open calendar
                  </Link>
                </div>
                <input type="hidden" name={unit.id} value={draft[unit.id] ?? "unassigned"} />
                <Select
                  items={items}
                  value={draft[unit.id] ?? "unassigned"}
                  disabled={pending}
                  onValueChange={(value) => {
                    if (typeof value !== "string") return;
                    setDraft((current) => ({ ...current, [unit.id]: value }));
                  }}
                >
                  <SelectTrigger className="h-10 w-full min-w-52 bg-background sm:w-56" aria-label={`Owner for ${unit.name}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </li>
          ))}
        </ul>
        <div className="sticky bottom-3 flex flex-wrap items-center gap-3 rounded-2xl bg-sea px-4 py-3 text-[#f6f3ec] shadow-lg">
          <Button type="submit" disabled={pending} variant="secondary" className="bg-[#f6f3ec] text-sea hover:bg-white">
            {pending ? "Saving…" : "Save assignments"}
          </Button>
          {state.error ? (
            <p role="alert" className="text-sm text-[#f6d4cf]">
              {state.error}
            </p>
          ) : null}
          {state.saved && !dirty && !pending ? <p className="text-sm text-white/80">Saved. Owners see the change on their next visit.</p> : null}
        </div>
      </form>
    </div>
  );
}

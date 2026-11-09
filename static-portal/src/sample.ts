import { listAccounts, listTagMappings, listUnits, seedAssignmentMap, toPublicAccount, type PublicAccount } from "@/lib/catalog";
import { buildMockIcs, buildMockStays } from "@/lib/mock-source";
import { parseIcs } from "@/lib/ics";
import { buildPortalView, type PortalView } from "@/lib/view";

/** Light gate only. The password is visible in this public static bundle. */
export const PREVIEW_PASSWORD = "gulf-preview";

const ASSIGNMENT_KEY = "rs-static-assignments";
const GATE_KEY = "rs-static-gate";
const USER_KEY = "rs-static-user";

const parsedCarts = parseIcs(buildMockIcs(), listTagMappings());

export const sampleSnapshot = {
  fetchedAt: new Date().toISOString(),
  source: "mock" as const,
  cartSource: "mock" as const,
  matchedUnitIds: null,
  stays: buildMockStays(),
  carts: parsedCarts.events,
  unmatchedCarts: parsedCarts.unmatched,
};

export function sampleAccounts() {
  return listAccounts().map((account) => ({
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    password: account.password,
  }));
}

export function matchAccount(email: string, password: string): PublicAccount | null {
  const account = sampleAccounts().find((item) => item.email.toLowerCase() === email.trim().toLowerCase());
  if (!account || account.password !== password) return null;
  return toPublicAccount(account);
}

export function loadAssignments(): Record<string, string | null> {
  try {
    const raw = localStorage.getItem(ASSIGNMENT_KEY);
    if (!raw) return seedAssignmentMap();
    const parsed = JSON.parse(raw) as Record<string, string | null>;
    const next = seedAssignmentMap();
    for (const unit of listUnits()) {
      if (unit.id in parsed) next[unit.id] = parsed[unit.id];
    }
    return next;
  } catch {
    return seedAssignmentMap();
  }
}

export function saveAssignments(assignments: Record<string, string | null>) {
  localStorage.setItem(ASSIGNMENT_KEY, JSON.stringify(assignments));
}

export function gateOpen(): boolean {
  return sessionStorage.getItem(GATE_KEY) === "open";
}

export function openGate() {
  sessionStorage.setItem(GATE_KEY, "open");
}

export function loadUser(): PublicAccount | null {
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as PublicAccount) : null;
  } catch {
    return null;
  }
}

export function saveUser(account: PublicAccount | null) {
  if (!account) sessionStorage.removeItem(USER_KEY);
  else sessionStorage.setItem(USER_KEY, JSON.stringify(account));
}

export function portalFor(
  account: PublicAccount,
  assignments: Record<string, string | null>,
  unit: string | undefined,
  month: string | undefined,
): PortalView {
  return buildPortalView({
    account,
    units: listUnits(),
    assignments,
    snapshot: sampleSnapshot,
    unit,
    month,
    now: new Date(),
  });
}

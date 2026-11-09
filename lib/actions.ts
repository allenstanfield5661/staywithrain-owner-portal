"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { writeAssignments } from "@/lib/assignments";
import { authenticate } from "@/lib/authenticate";
import { getAccount } from "@/lib/auth";
import { listUnits } from "@/lib/catalog";
import { dataMode } from "@/lib/data-mode";
import { createInviteToken, inviteUrl, readInviteToken } from "@/lib/invites";
import { loadOwners, saveOwners, type StoredOwner } from "@/lib/owner-store";
import { hashPassword } from "@/lib/passwords";
import { allowAttempt } from "@/lib/rate-limit";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";

export type ActionState = {
  error: string;
  saved?: boolean;
  inviteUrl?: string;
};

function formFromAction(prevOrForm: ActionState | FormData, maybeForm?: FormData): FormData {
  if (maybeForm) return maybeForm;
  return prevOrForm as FormData;
}

async function clientKey(suffix: string): Promise<string> {
  const headerStore = await headers();
  const ip =
    headerStore.get("x-nf-client-connection-ip") ||
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local";
  return `${suffix}:${ip}`;
}

export async function loginAction(prevOrForm: ActionState | FormData, maybeForm?: FormData): Promise<ActionState> {
  const formData = formFromAction(prevOrForm, maybeForm);
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (email.length > 200 || password.length > 200) {
    return { error: "That email and password don't match a portal account." };
  }
  if (!(await allowAttempt(await clientKey(`login:${email.toLowerCase()}`)))) {
    return { error: "Too many sign-in attempts. Wait a few minutes and try again." };
  }
  const account = await authenticate(email, password);
  if (!account) {
    return { error: "That email and password don't match a portal account." };
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, signSession(account.id, Date.now(), account.role), sessionCookieOptions);
  redirect("/portal");
}

export async function loginWithForm(formData: FormData): Promise<void> {
  await loginAction(formData);
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  redirect("/");
}

export async function saveAssignmentsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (dataMode() === "live") return { error: "Use the live owner list to change assignments." };
  const account = await getAccount();
  if (!account || account.role !== "admin") {
    return { error: "Only an admin can change assignments." };
  }
  const assignments: Record<string, string | null> = {};
  for (const unit of listUnits()) {
    const value = formData.get(unit.id);
    assignments[unit.id] = typeof value === "string" ? value : null;
  }
  try {
    writeAssignments(assignments);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Those assignments could not be saved." };
  }
  revalidatePath("/portal");
  revalidatePath("/admin");
  return { error: "", saved: true };
}

export async function saveOwnersAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const account = await getAccount();
  if (!account || account.role !== "admin" || dataMode() !== "live") {
    return { error: "Only an admin can change owners." };
  }
  let incoming: Array<{ id?: string; name?: string; email?: string; listingIds?: string[] }>;
  try {
    incoming = JSON.parse(String(formData.get("owners") ?? "[]")) as typeof incoming;
  } catch {
    return { error: "The owner list could not be read." };
  }
  const existing = await loadOwners();
  const next: StoredOwner[] = [];
  for (const entry of incoming) {
    const email = entry.email?.trim().toLowerCase() ?? "";
    const name = entry.name?.trim() ?? "";
    if (!email || !name || !email.includes("@")) return { error: "Each owner needs a name and email." };
    const id = entry.id?.trim() || `owner-${email.replace(/[^a-z0-9]+/g, "-")}`;
    const prior = existing.find((owner) => owner.id === id || owner.email === email);
    next.push({
      id: prior?.id ?? id,
      name,
      email,
      passwordHash: prior?.passwordHash ?? null,
      listingIds: Array.isArray(entry.listingIds) ? entry.listingIds.map(String) : [],
    });
  }
  try {
    await saveOwners(next);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Those owners could not be saved." };
  }
  revalidatePath("/portal");
  revalidatePath("/admin");
  return { error: "", saved: true };
}

export async function createInviteAction(ownerId: string): Promise<ActionState> {
  const account = await getAccount();
  if (!account || account.role !== "admin" || dataMode() !== "live") {
    return { error: "Only an admin can create an invite." };
  }
  const owner = (await loadOwners()).find((item) => item.id === ownerId);
  if (!owner) return { error: "Save the owner before creating an invite." };
  return { error: "", inviteUrl: inviteUrl(createInviteToken(owner.email)) };
}

export async function setPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await allowAttempt(await clientKey("set-password")))) {
    return { error: "Too many attempts. Wait a few minutes and try again." };
  }
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const invite = readInviteToken(token);
  if (!invite) return { error: "This invite link is invalid or has expired." };
  if (password.length < 10) return { error: "Use at least 10 characters." };
  if (password !== confirm) return { error: "Those passwords do not match." };
  const owners = await loadOwners();
  const owner = owners.find((item) => item.email === invite.email);
  if (!owner) return { error: "This invite does not match an owner account." };
  owner.passwordHash = await hashPassword(password);
  await saveOwners(owners);
  redirect("/?password=saved");
}

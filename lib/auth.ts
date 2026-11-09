import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findAccountById, type Account } from "@/lib/catalog";
import { dataMode } from "@/lib/data-mode";
import { loadOwners } from "@/lib/owner-store";
import { readSessionToken, SESSION_COOKIE } from "@/lib/session";

function adminAccount(): Account {
  return {
    id: "admin",
    name: "Rain / Stanfield",
    email: process.env.ADMIN_EMAIL?.trim().toLowerCase() || "admin@rainstanfield.example",
    role: "admin",
    password: "",
  };
}

export async function getAccount(): Promise<Account | null> {
  const jar = await cookies();
  const session = readSessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  if (dataMode() !== "live") return findAccountById(session.uid) ?? null;
  if (session.uid === "admin" && session.role === "admin") return adminAccount();
  const owner = (await loadOwners()).find((item) => item.id === session.uid);
  if (!owner) return null;
  return { id: owner.id, name: owner.name, email: owner.email, role: "owner", password: "" };
}

export async function requireAccount(): Promise<Account> {
  const account = await getAccount();
  if (!account) redirect("/");
  return account;
}

export async function requireAdmin(): Promise<Account> {
  const account = await requireAccount();
  if (account.role !== "admin") redirect("/portal");
  return account;
}

export async function redirectIfSignedIn(): Promise<void> {
  const account = await getAccount();
  if (account) redirect("/portal");
}

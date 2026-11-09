import { dataMode } from "@/lib/data-mode";
import { findAccountByEmail, toPublicAccount, type PublicAccount } from "@/lib/catalog";
import { loadOwners } from "@/lib/owner-store";
import { verifyPassword } from "@/lib/passwords";
import { passwordsMatch } from "@/lib/session";

export async function authenticate(email: string, password: string): Promise<PublicAccount | null> {
  const needle = email.trim().toLowerCase();
  if (!needle || !password) return null;
  if (dataMode() !== "live") {
    const account = findAccountByEmail(needle);
    if (!account || !passwordsMatch(password, account.password)) return null;
    return toPublicAccount(account);
  }
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminHash = process.env.ADMIN_PASSWORD_HASH?.trim();
  if (adminEmail && needle === adminEmail) {
    if (!adminHash || !(await verifyPassword(password, adminHash))) return null;
    return { id: "admin", name: "Rain / Stanfield", email: adminEmail, role: "admin" };
  }
  const owner = (await loadOwners()).find((item) => item.email === needle);
  if (!owner?.passwordHash || !(await verifyPassword(password, owner.passwordHash))) return null;
  return { id: owner.id, name: owner.name, email: owner.email, role: "owner" };
}

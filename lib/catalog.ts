import accountsJson from "@/config/accounts.json";
import assignmentsJson from "@/config/assignments.json";
import cartTagsJson from "@/config/cart-tags.json";
import unitsJson from "@/config/units.json";

export type Role = "owner" | "admin";

export type Account = {
  id: string;
  name: string;
  email: string;
  role: Role;
  password: string;
};

export type PublicAccount = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export type Unit = {
  id: string;
  name: string;
  town: string;
  bedrooms: number;
  hostawayListingId: number | null;
};

export type TagMapping = {
  tag: string;
  unitId: string;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function loadAccounts(): Account[] {
  const accounts = accountsJson as Account[];
  const ids = new Set<string>();
  const emails = new Set<string>();
  for (const account of accounts) {
    assert(account.id && account.name && account.email && account.password, "Each account needs an id, name, email, and password.");
    assert(account.role === "owner" || account.role === "admin", `Unknown role for ${account.email}.`);
    assert(!ids.has(account.id), `Duplicate account id ${account.id}.`);
    const email = account.email.toLowerCase();
    assert(!emails.has(email), `Duplicate account email ${account.email}.`);
    ids.add(account.id);
    emails.add(email);
  }
  assert(accounts.some((account) => account.role === "admin"), "At least one admin account is required.");
  return accounts;
}

function loadUnits(): Unit[] {
  const units = unitsJson as Unit[];
  const ids = new Set<string>();
  for (const unit of units) {
    assert(unit.id && unit.name && unit.town, "Each unit needs an id, name, and town.");
    assert(!ids.has(unit.id), `Duplicate unit id ${unit.id}.`);
    assert(Number.isInteger(unit.bedrooms) && unit.bedrooms > 0, `Bedrooms for ${unit.name} must be a positive number.`);
    ids.add(unit.id);
  }
  return units;
}

const accounts = loadAccounts();
const units = loadUnits();
const unitIds = new Set(units.map((unit) => unit.id));

const cartTags = cartTagsJson as { calendarName: string; mappings: TagMapping[] };
for (const mapping of cartTags.mappings) {
  assert(mapping.tag.startsWith("(") && mapping.tag.endsWith(")"), `Cart tag ${mapping.tag} should include parentheses.`);
  assert(unitIds.has(mapping.unitId), `Cart tag ${mapping.tag} points at unknown unit ${mapping.unitId}.`);
}

const seedAssignments = assignmentsJson as Record<string, string | null>;
for (const unit of units) {
  assert(unit.id in seedAssignments, `Missing a seed assignment for ${unit.name}.`);
}

export function listAccounts(): Account[] {
  return accounts;
}

export function listUnits(): Unit[] {
  return units;
}

export function listTagMappings(): TagMapping[] {
  return cartTags.mappings;
}

export function expectedCalendarName(): string {
  return cartTags.calendarName;
}

export function tagsForUnit(unitId: string): string[] {
  return cartTags.mappings.filter((mapping) => mapping.unitId === unitId).map((mapping) => mapping.tag);
}

export function tagsForListing(unit: { id: string; name: string }): string[] {
  const match = units.find(
    (item) =>
      item.id === unit.id ||
      (item.hostawayListingId != null && String(item.hostawayListingId) === unit.id) ||
      normalizeName(item.name) === normalizeName(unit.name),
  );
  return match ? tagsForUnit(match.id) : [];
}

export function seedAssignmentMap(): Record<string, string | null> {
  return { ...seedAssignments };
}

export function toPublicAccount(account: Account): PublicAccount {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
  };
}

export function findAccountByEmail(email: string): Account | undefined {
  const needle = email.trim().toLowerCase();
  return accounts.find((account) => account.email.toLowerCase() === needle);
}

export function findAccountById(id: string): Account | undefined {
  return accounts.find((account) => account.id === id);
}

export function ownerAccounts(): PublicAccount[] {
  return accounts.filter((account) => account.role === "owner").map(toPublicAccount);
}

export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

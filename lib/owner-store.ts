import fs from "node:fs";
import path from "node:path";
import { dataMode } from "@/lib/data-mode";
import { duplicateOwnerEmailMessage, normalizeOwnerEmail } from "@/lib/owner-rules";
import { BLOB_TIMEOUT_MS, withTimeout } from "@/lib/timeout";

export type StoredOwner = {
  id: string;
  name: string;
  email: string;
  passwordHash: string | null;
  listingIds: string[];
};

export type PublicOwner = {
  id: string;
  name: string;
  email: string;
  listingIds: string[];
  hasPassword: boolean;
};

export type OwnerDraft = {
  id?: string;
  name?: string;
  email?: string;
  listingIds?: string[];
};

const localPath = path.join(process.cwd(), "data", "owners.live.json");

let testOwners: StoredOwner[] | null = null;
let testMode = false;

export function useTestOwners(owners: StoredOwner[] | null): void {
  testMode = true;
  testOwners = owners ? owners.map(cloneOwner) : null;
}

export function resetTestOwners(): void {
  testMode = false;
  testOwners = null;
}

function cloneOwner(owner: StoredOwner): StoredOwner {
  return { ...owner, listingIds: [...owner.listingIds] };
}

function cleanListingIds(listingIds: unknown): string[] {
  if (!Array.isArray(listingIds)) return [];
  const ids = listingIds.map((id) => String(id).trim()).filter(Boolean);
  return [...new Set(ids)];
}

export function normalizeStoredOwner(owner: StoredOwner): StoredOwner {
  return {
    id: owner.id.trim(),
    name: owner.name.trim(),
    email: normalizeOwnerEmail(owner.email),
    passwordHash: owner.passwordHash ?? null,
    listingIds: cleanListingIds(owner.listingIds),
  };
}

function assertUniqueOwnerLogins(owners: StoredOwner[]): void {
  const emails = new Set<string>();
  const ids = new Set<string>();
  for (const owner of owners) {
    if (!owner.id) throw new Error("Each owner needs an id.");
    if (!owner.name || !owner.email || !owner.email.includes("@")) {
      throw new Error("Each owner needs a name and email.");
    }
    if (ids.has(owner.id)) throw new Error("Each owner needs a unique id.");
    if (emails.has(owner.email)) throw new Error(duplicateOwnerEmailMessage(owner.email));
    ids.add(owner.id);
    emails.add(owner.email);
  }
}

export function mergeOwnerDrafts(existing: StoredOwner[], incoming: OwnerDraft[]): StoredOwner[] {
  const drafts = incoming.map((entry) => {
    const email = normalizeOwnerEmail(entry.email ?? "");
    const name = entry.name?.trim() ?? "";
    if (!name || !email || !email.includes("@")) {
      throw new Error("Each owner needs a name and email.");
    }
    return {
      id: entry.id?.trim() || `owner-${email.replace(/[^a-z0-9]+/g, "-")}`,
      name,
      email,
      listingIds: cleanListingIds(entry.listingIds),
    };
  });

  const seenEmails = new Set<string>();
  const seenIds = new Set<string>();
  for (const draft of drafts) {
    if (seenIds.has(draft.id)) throw new Error("Each owner needs a unique id.");
    if (seenEmails.has(draft.email)) throw new Error(duplicateOwnerEmailMessage(draft.email));
    seenIds.add(draft.id);
    seenEmails.add(draft.email);
  }

  const incomingIds = new Set(drafts.map((draft) => draft.id));
  return drafts.map((draft) => {
    const priorById = existing.find((owner) => owner.id === draft.id);
    const priorByEmail = existing.find((owner) => normalizeOwnerEmail(owner.email) === draft.email);
    const emailKeptOnAnotherLogin =
      priorByEmail !== undefined && priorByEmail.id !== draft.id && incomingIds.has(priorByEmail.id);
    const prior = priorById ?? (emailKeptOnAnotherLogin ? undefined : priorByEmail);
    return {
      id: prior?.id ?? draft.id,
      name: draft.name,
      email: draft.email,
      passwordHash: prior?.passwordHash ?? null,
      listingIds: draft.listingIds,
    };
  });
}

export function parseOwnersConfig(raw: string): StoredOwner[] {
  const parsed = JSON.parse(raw) as { owners?: unknown };
  if (!parsed || !Array.isArray(parsed.owners)) {
    throw new Error("OWNERS_JSON must be an object with an owners array.");
  }
  return parsed.owners.map((entry) => {
    const owner = entry as Partial<StoredOwner>;
    if (!owner.id || !owner.name || !owner.email) {
      throw new Error("Each owner needs an id, name, and email.");
    }
    return {
      id: owner.id,
      name: owner.name,
      email: normalizeOwnerEmail(owner.email),
      passwordHash: owner.passwordHash ?? null,
      listingIds: Array.isArray(owner.listingIds) ? owner.listingIds.map(String) : [],
    };
  });
}

function seedFromEnv(): StoredOwner[] {
  const raw = process.env.OWNERS_JSON?.trim();
  if (!raw) return [];
  return parseOwnersConfig(raw);
}

async function readBlobOwners(): Promise<StoredOwner[] | null> {
  if (process.env.NETLIFY !== "true" && !process.env.NETLIFY_BLOBS_CONTEXT) return null;
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore("owner-portal");
    const raw = await withTimeout(store.get("owners", { type: "text" }), BLOB_TIMEOUT_MS, "Blob read timed out");
    if (!raw) return null;
    return parseOwnersConfig(raw);
  } catch {
    return null;
  }
}

async function writeBlobOwners(owners: StoredOwner[]): Promise<void> {
  if (process.env.NETLIFY !== "true" && !process.env.NETLIFY_BLOBS_CONTEXT) return;
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore("owner-portal");
    await withTimeout(store.set("owners", JSON.stringify({ owners })), BLOB_TIMEOUT_MS, "Blob write timed out");
  } catch {
    // File fallback below still records the change when the disk is writable.
  }
}

function readFileOwners(): StoredOwner[] | null {
  if (!fs.existsSync(localPath)) return null;
  return parseOwnersConfig(fs.readFileSync(localPath, "utf8"));
}

function writeFileOwners(owners: StoredOwner[]): void {
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, `${JSON.stringify({ owners }, null, 2)}\n`);
}

export async function loadOwners(): Promise<StoredOwner[]> {
  if (dataMode() !== "live" && !testMode) return [];
  if (testMode) return (testOwners ?? []).map(cloneOwner);
  const blob = await readBlobOwners();
  if (blob) return blob;
  const file = readFileOwners();
  if (file) return file;
  return seedFromEnv();
}

export async function saveOwners(owners: StoredOwner[]): Promise<void> {
  const normalized = owners.map((owner) => normalizeStoredOwner(owner));
  assertUniqueOwnerLogins(normalized);
  if (testMode) {
    testOwners = normalized;
    return;
  }
  await writeBlobOwners(normalized);
  try {
    writeFileOwners(normalized);
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code) : "";
    if (code !== "EROFS" && code !== "EPERM" && code !== "EACCES") throw error;
    if (process.env.NETLIFY !== "true" && !process.env.NETLIFY_BLOBS_CONTEXT) {
      throw new Error("Owner records could not be saved on this machine.");
    }
  }
}

export async function liveAssignmentMap(): Promise<Record<string, string | string[]>> {
  const grouped = new Map<string, string[]>();
  for (const owner of await loadOwners()) {
    for (const listingId of owner.listingIds) {
      const ownerIds = grouped.get(listingId) ?? [];
      if (!ownerIds.includes(owner.id)) ownerIds.push(owner.id);
      grouped.set(listingId, ownerIds);
    }
  }
  const map: Record<string, string | string[]> = {};
  for (const [listingId, ownerIds] of grouped) {
    map[listingId] = ownerIds.length === 1 ? ownerIds[0] : ownerIds;
  }
  return map;
}

export function toPublicOwner(owner: StoredOwner): PublicOwner {
  return {
    id: owner.id,
    name: owner.name,
    email: owner.email,
    listingIds: [...owner.listingIds],
    hasPassword: Boolean(owner.passwordHash),
  };
}

export async function publicOwners(): Promise<PublicOwner[]> {
  return (await loadOwners()).map(toPublicOwner);
}

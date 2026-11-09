import fs from "node:fs";
import path from "node:path";
import { dataMode } from "@/lib/data-mode";

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
      email: owner.email.trim().toLowerCase(),
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
    const raw = await store.get("owners", { type: "text" });
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
    await store.set("owners", JSON.stringify({ owners }));
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
  const normalized = owners.map((owner) => ({
    ...cloneOwner(owner),
    email: owner.email.trim().toLowerCase(),
    listingIds: [...new Set(owner.listingIds.map(String))],
  }));
  const seenListings = new Set<string>();
  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    normalized[index].listingIds = normalized[index].listingIds.filter((id) => {
      if (seenListings.has(id)) return false;
      seenListings.add(id);
      return true;
    });
  }
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

export async function liveAssignmentMap(): Promise<Record<string, string | null>> {
  const map: Record<string, string | null> = {};
  for (const owner of await loadOwners()) {
    for (const listingId of owner.listingIds) map[listingId] = owner.id;
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

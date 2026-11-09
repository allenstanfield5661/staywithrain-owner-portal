import fs from "node:fs";
import path from "node:path";
import { findAccountById, listUnits, seedAssignmentMap } from "@/lib/catalog";

const localPath = path.join(process.cwd(), "data", "assignments.local.json");

export function normalizeAssignmentMap(input: unknown): Record<string, string | null> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Assignments must be an object of unit id to owner id.");
  }
  const record = input as Record<string, unknown>;
  const next: Record<string, string | null> = {};
  for (const unit of listUnits()) {
    if (!(unit.id in record)) {
      throw new Error(`Missing an assignment for ${unit.name}.`);
    }
    const ownerId = record[unit.id];
    if (ownerId === null || ownerId === "unassigned" || ownerId === "") {
      next[unit.id] = null;
      continue;
    }
    if (typeof ownerId !== "string") {
      throw new Error(`Assignment for ${unit.name} is not an owner id.`);
    }
    const owner = findAccountById(ownerId);
    if (!owner || owner.role !== "owner") {
      throw new Error(`${unit.name} can only be assigned to an owner account.`);
    }
    next[unit.id] = owner.id;
  }
  return next;
}

export function readAssignments(): Record<string, string | null> {
  if (!fs.existsSync(localPath)) return seedAssignmentMap();
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(localPath, "utf8"));
  } catch {
    throw new Error("The local assignment file could not be read. Remove data/assignments.local.json and try again.");
  }
  return normalizeAssignmentMap(parsed);
}

export function writeAssignments(assignments: Record<string, string | null>): void {
  const normalized = normalizeAssignmentMap(assignments);
  try {
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, `${JSON.stringify(normalized, null, 2)}\n`);
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code) : "";
    if (code === "EROFS" || code === "EPERM" || code === "EACCES") {
      throw new Error("This hosted preview keeps the seeded owners. Assignment changes are saved only when the app runs on a machine with a writable disk.");
    }
    throw error;
  }
}

import cartAliasesJson from "@/config/cart-aliases.json";
import { listTagMappings, normalizeName, type TagMapping, type Unit } from "@/lib/catalog";
import { redactEventLabel, redactGuestName } from "@/lib/privacy";

type CartAliasesConfig = {
  aliases?: Record<string, string[]>;
  cartOwners?: Record<string, string>;
};

const config = cartAliasesJson as CartAliasesConfig;

export type CartTitle = {
  guest: string;
  property: string;
  tag: string;
};

export type CartAssignment = {
  unitIds: string[];
  tag: string;
  label: string;
};

const SKIP_TITLES = /\b(road trip|meeting|staff|internal|maintenance|shop)\b/i;

/** Known cart tags, longest first so (7A) wins over (A). */
export function knownCartTags(): string[] {
  const tags = new Set<string>();
  for (const tag of Object.keys(config.cartOwners ?? {})) tags.add(tag);
  for (const mapping of listTagMappings()) tags.add(mapping.tag);
  return [...tags].sort((a, b) => b.length - a.length);
}

export function cartOwnerTagMappings(): TagMapping[] {
  return Object.entries(config.cartOwners ?? {}).map(([tag, unitId]) => ({ tag, unitId }));
}

function normalizeTag(tag: string): string {
  return tag.normalize("NFKC").replace(/[’‘ʼ]/g, "'").toLowerCase();
}

function isCartTag(inner: string): boolean {
  const value = inner.trim();
  if (!value || value.length > 16) return false;
  const known = knownCartTags().some((tag) => normalizeTag(tag) === normalizeTag(`(${value})`));
  if (known) return true;
  return /^(?:[A-Za-z]|[A-Za-z]?\d+[A-Za-z]?|Donald'?s)$/i.test(value);
}

/**
 * Exact cart-tag match from parentheticals in the title.
 * Compares full "(…)" groups so "(7A)" never counts as "(A)".
 */
export function extractCartTag(summary: string, tags: string[] = knownCartTags()): string | null {
  const haystack = summary.normalize("NFKC").replace(/[’‘ʼ]/g, "'");
  const found: string[] = [];
  const re = /\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(haystack))) {
    found.push(`(${match[1]})`);
  }
  if (found.length === 0) return null;
  const ordered = [...tags].sort((a, b) => b.length - a.length);
  for (const tag of ordered) {
    const needle = normalizeTag(tag);
    if (found.some((item) => normalizeTag(item) === needle)) return tag;
  }
  return null;
}

export function parseCartTitle(summary: string): CartTitle {
  let rest = summary.normalize("NFKC").replace(/[’‘ʼ]/g, "'").replace(/\s+/g, " ").trim();
  rest = rest.replace(/^rented:\s*/i, "");
  let tag = "";
  const trailing = /\(([^)]+)\)\s*$/.exec(rest);
  if (trailing && isCartTag(trailing[1])) {
    tag = `(${trailing[1]})`;
    // Normalize Donald's apostrophe to the canonical cartOwners key when present.
    const canonical = knownCartTags().find((item) => normalizeTag(item) === normalizeTag(tag));
    if (canonical) tag = canonical;
    rest = rest.slice(0, trailing.index).trim();
  }
  const parenProp = /^(.+?)\s*\((.+)\)$/.exec(rest);
  if (parenProp) {
    return { guest: parenProp[1].trim(), property: parenProp[2].trim(), tag };
  }
  const dash = /^(.+?)\s*[-–—]\s*(.+)$/.exec(rest);
  if (dash) {
    return { guest: dash[1].trim(), property: dash[2].trim(), tag };
  }
  return { guest: rest, property: "", tag };
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = normalizeName(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export function namesForUnit(unit: Unit, extra: string[] = []): string[] {
  return unique([unit.name, ...(unit.aliases ?? []), ...extra]);
}

export function cartOwnerUnitId(tag: string, units: Unit[]): string | null {
  if (!tag) return null;
  const owner = config.cartOwners?.[tag] ?? config.cartOwners?.[normalizeTag(tag)];
  // Also try canonical key match for curly apostrophes.
  let ownerId = owner;
  if (!ownerId) {
    const key = Object.keys(config.cartOwners ?? {}).find((item) => normalizeTag(item) === normalizeTag(tag));
    if (key) ownerId = config.cartOwners?.[key];
  }
  if (ownerId) {
    const unit = units.find((item) => item.id === ownerId || String(item.hostawayListingId ?? "") === ownerId);
    if (unit) return unit.id;
    // Live units use the listing id as unit.id; allow the listing id even before units load.
    return ownerId;
  }
  const mapping = listTagMappings().find((item) => normalizeTag(item.tag) === normalizeTag(tag));
  if (!mapping) return null;
  const mock = units.find((item) => item.id === mapping.unitId);
  return mock?.id ?? mapping.unitId;
}

export function cartTagsForUnit(unit: Unit): string[] {
  const listingIds = new Set(
    [unit.id, unit.hostawayListingId != null ? String(unit.hostawayListingId) : ""]
      .filter(Boolean)
      .map(String),
  );
  const tags: string[] = [];
  for (const [tag, owner] of Object.entries(config.cartOwners ?? {})) {
    if (listingIds.has(owner)) tags.push(tag);
  }
  return tags;
}

export function labelForCartTitle(title: CartTitle, summary: string): string {
  if (title.guest) {
    const labeled = redactGuestName(null, null, title.guest);
    if (labeled !== "Guest") return labeled;
  }
  return redactEventLabel(summary, title.tag || "\0");
}

/**
 * Match a cart rental to the owning house by the cart TAG in the title.
 * Property names in the title are ignored for assignment.
 */
export function assignCartEvent(
  summary: string,
  units: Unit[],
  options?: { defaultTag?: string; forceTag?: string },
): CartAssignment | null {
  const cleaned = summary.normalize("NFKC").replace(/[’‘ʼ]/g, "'").trim();
  if (!cleaned || SKIP_TITLES.test(cleaned)) return null;
  const title = parseCartTitle(cleaned);
  let tag = options?.forceTag || title.tag || extractCartTag(cleaned) || options?.defaultTag || "";
  if (tag) {
    const canonical = knownCartTags().find((item) => normalizeTag(item) === normalizeTag(tag));
    if (canonical) tag = canonical;
  }
  if (!tag) return null;
  const ownerId = cartOwnerUnitId(tag, units);
  if (!ownerId) return null;
  // Prefer a unit that is present in the provided list.
  const present = units.find((item) => item.id === ownerId || String(item.hostawayListingId ?? "") === ownerId);
  const unitId = present?.id ?? ownerId;
  return { unitIds: [unitId], tag, label: labelForCartTitle({ ...title, tag }, cleaned) };
}

export function dedupeCarts<T extends { id: string; unitId: string; label: string; start: string; end: string }>(
  events: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const event of events) {
    const key = `${event.unitId}|${event.start}|${event.end}|${normalizeName(event.label)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(event);
  }
  return out;
}

export function golfCartFeedUrls(): string[] {
  const collected: string[] = [];
  const many = process.env.GOLF_CART_ICS_URLS ?? "";
  const single = process.env.GOLF_CART_ICS_URL?.trim() ?? "";
  for (const part of many.split(/[\s,]+/)) {
    if (part) collected.push(part);
  }
  if (single && !collected.includes(single)) collected.push(single);
  return collected;
}

export function isSubediCalendar(name: string | null | undefined): boolean {
  return Boolean(name && /subedi/i.test(name));
}

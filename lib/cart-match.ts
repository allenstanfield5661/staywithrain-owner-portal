import cartAliasesJson from "@/config/cart-aliases.json";
import { normalizeName, type Unit } from "@/lib/catalog";
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

function isCartTag(inner: string): boolean {
  const value = inner.trim();
  if (!value || value.length > 16) return false;
  return /^(?:[A-Za-z]|[A-Za-z]?\d+[A-Za-z]?|Donald'?s)$/i.test(value);
}

export function parseCartTitle(summary: string): CartTitle {
  let rest = summary.normalize("NFKC").replace(/[’‘ʼ]/g, "'").replace(/\s+/g, " ").trim();
  rest = rest.replace(/^rented:\s*/i, "");
  let tag = "";
  const trailing = /\(([^)]+)\)\s*$/.exec(rest);
  if (trailing && isCartTag(trailing[1])) {
    tag = `(${trailing[1]})`;
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

type Candidate = { unitId: string; alias: string; score: number };

function collectCandidates(property: string, units: Unit[]): Candidate[] {
  const needle = normalizeName(property);
  if (!needle) return [];
  const candidates: Candidate[] = [];
  for (const unit of units) {
    const extras = config.aliases?.[unit.id] ?? config.aliases?.[String(unit.hostawayListingId ?? "")] ?? [];
    for (const alias of namesForUnit(unit, extras)) {
      const key = normalizeName(alias);
      if (!key || key.length < 4) continue;
      if (needle === key) {
        candidates.push({ unitId: unit.id, alias, score: 1000 + key.length });
      } else if (needle.includes(key) || (key.includes(needle) && needle.length >= 8)) {
        candidates.push({ unitId: unit.id, alias, score: key.length });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

export function matchPropertyToUnits(property: string, units: Unit[]): string[] {
  const candidates = collectCandidates(property, units);
  if (candidates.length === 0) return [];
  const best = candidates[0].score;
  const ids = unique(candidates.filter((item) => item.score === best).map((item) => item.unitId));
  return ids.length === 1 ? ids : [];
}

export function cartOwnerUnitId(tag: string, units: Unit[]): string | null {
  if (!tag) return null;
  const owner = config.cartOwners?.[tag];
  if (!owner) return null;
  const unit = units.find((item) => item.id === owner || String(item.hostawayListingId ?? "") === owner);
  return unit?.id ?? null;
}

export function labelForCartTitle(title: CartTitle, summary: string): string {
  if (title.guest) {
    const labeled = redactGuestName(null, null, title.guest);
    if (labeled !== "Guest") return labeled;
  }
  return redactEventLabel(summary, title.tag || "\0");
}

export function assignCartEvent(summary: string, units: Unit[]): CartAssignment | null {
  const cleaned = summary.normalize("NFKC").replace(/[’‘ʼ]/g, "'").trim();
  if (!cleaned || SKIP_TITLES.test(cleaned)) return null;
  const title = parseCartTitle(cleaned);
  const fromProperty = title.property ? matchPropertyToUnits(title.property, units) : [];
  const ownerId = cartOwnerUnitId(title.tag, units);
  const unitIds = unique([...fromProperty, ...(ownerId && !fromProperty.includes(ownerId) ? [ownerId] : [])]);
  if (unitIds.length === 0) return null;
  return { unitIds, tag: title.tag, label: labelForCartTitle(title, cleaned) };
}

export function dedupeCarts<T extends { id: string; unitId: string; label: string; start: string; end: string }>(events: T[]): T[] {
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

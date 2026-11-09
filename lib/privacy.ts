const GENERIC_WORDS = new Set([
  "golf",
  "cart",
  "rental",
  "rentals",
  "weekend",
  "family",
  "afternoon",
  "morning",
  "evening",
  "day",
  "night",
  "reserved",
  "reservation",
  "block",
  "hold",
  "unit",
  "guest",
  "guests",
  "owner",
  "stay",
  "shop",
  "maintenance",
]);

export function stripContact(value: string): string {
  return value
    .replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleWord(word: string): string {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function nameTokens(value: string): string[] {
  return stripContact(value)
    .replace(/[^\p{L}\s'-]/gu, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^['-]+|['-]+$/g, ""))
    .filter((token) => token.length > 0);
}

/** First name plus last initial. Never returns a full surname, email, or phone. */
export function redactGuestName(
  first?: string | null,
  last?: string | null,
  full?: string | null,
): string {
  let firstTokens = first ? nameTokens(first) : [];
  let lastTokens = last ? nameTokens(last) : [];
  if (firstTokens.length === 0 && full) {
    const parts = nameTokens(full);
    if (parts.length === 1) firstTokens = parts;
    else if (parts.length > 1) {
      firstTokens = [parts[0]];
      lastTokens = [parts[parts.length - 1]];
    }
  }
  const firstName = titleWord(firstTokens[0] ?? "");
  const surname = lastTokens[lastTokens.length - 1] ?? "";
  if (!firstName) return "Guest";
  if (!surname) return firstName;
  return `${firstName} ${surname.charAt(0).toUpperCase()}.`;
}

export function looksLikePerson(value: string): boolean {
  const tokens = nameTokens(value);
  if (tokens.length < 2 || tokens.length > 3) return false;
  return tokens.every((token) => {
    if (GENERIC_WORDS.has(token.toLowerCase())) return false;
    return /^\p{L}[\p{L}'-]*$/u.test(token);
  });
}

/** Label for a cart event after the unit tag has been removed. */
export function redactEventLabel(summary: string, tag: string): string {
  const tagPattern = new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig");
  let rest = stripContact(summary.normalize("NFKC").replace(/[’‘ʼ]/g, "'")).replace(tagPattern, " ");
  rest = rest.replace(/\s+/g, " ").trim();
  const pieces = rest
    .split(/\s[—–-]\s|:\s/)
    .map((piece) => piece.trim())
    .filter(Boolean);
  for (const piece of [...pieces].reverse()) {
    if (looksLikePerson(piece)) return redactGuestName(null, null, piece);
  }
  const phrase = rest
    .replace(/\bgolf\s*cart\b/gi, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!phrase) return "Cart rental";
  return phrase.length > 42 ? `${phrase.slice(0, 41).trim()}…` : phrase;
}

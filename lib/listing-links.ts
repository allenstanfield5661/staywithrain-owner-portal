import listingLinksJson from "@/config/listing-links.json";

type ListingLinksConfig = {
  bookingSite: string;
  bookableListingIds: number[];
  welcomeGuides: Record<string, string>;
};

const config = listingLinksJson as ListingLinksConfig;
const bookable = new Set(config.bookableListingIds.map(String));

export function listingIdFor(unit: { id: string; hostawayListingId?: number | null }): string | null {
  if (unit.hostawayListingId != null) return String(unit.hostawayListingId);
  if (/^\d+$/.test(unit.id)) return unit.id;
  return null;
}

export function bookingUrlFor(unit: { id: string; hostawayListingId?: number | null }): string | null {
  const id = listingIdFor(unit);
  if (!id || !bookable.has(id)) return null;
  return `${config.bookingSite.replace(/\/$/, "")}/listings/${id}`;
}

export function welcomeGuideUrlFor(unit: { id: string; hostawayListingId?: number | null }): string | null {
  const id = listingIdFor(unit);
  if (!id) return null;
  const url = config.welcomeGuides[id]?.trim();
  return url || null;
}

export function bookingSite(): string {
  return config.bookingSite;
}

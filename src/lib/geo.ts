/**
 * Pure geography helpers: distance math, distance formatting and the curated
 * area catalogue behind the manual location picker.
 *
 * Deliberately free of native imports so every screen (and web) can use it
 * without pulling in `expo-location`.
 */

export interface Coords {
  latitude: number;
  longitude: number;
}

export interface Area extends Coords {
  /** Locality name shown in the picker, e.g. "Dhanmondi". */
  name: string;
  /** Parent city, used to group the picker and to label distances. */
  city: string;
  /** Extra spellings that should resolve to this area. */
  aliases?: string[];
}

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export function hasCoords(value: Partial<Coords> | null | undefined): boolean {
  return (
    !!value &&
    typeof value.latitude === 'number' &&
    typeof value.longitude === 'number' &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude)
  );
}

/** Great-circle distance between two points, in kilometres. */
export function haversineKm(from: Coords, to: Coords): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Human distance: metres when close, one decimal under 10 km, whole numbers
 * beyond that. Returns null when there is nothing honest to show.
 */
export function formatDistanceKm(km: number | null | undefined): string | null {
  if (km == null || !Number.isFinite(km) || km < 0) return null;
  if (km < 1) {
    const metres = Math.max(50, Math.round((km * 1000) / 50) * 50);
    return `${metres} m`;
  }
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/** Rounds a computed distance in the same way the UI displays it. */
export function roundDistanceKm(km: number): number {
  if (km < 1) return Math.max(0.05, Math.round((km * 1000) / 50) * 0.05);
  if (km < 10) return Math.round(km * 10) / 10;
  return Math.round(km);
}

/** Radius options offered in the picker. `null` means no distance limit. */
export const RADIUS_OPTIONS: { value: number | null; label: string }[] = [
  { value: 1, label: '1 km' },
  { value: 2, label: '2 km' },
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 25, label: '25 km' },
  { value: null, label: 'Anywhere' },
];

export function formatRadius(radius: number | null): string {
  if (radius == null) return 'Anywhere';
  return `Within ${radius} km`;
}

/**
 * Approximate locality centroids. Used for the manual picker, for resolving the
 * free-text areas already stored on listings, and as a fallback when reverse
 * geocoding is unavailable. Not survey-grade — good enough to say "about 2 km".
 */
export const AREAS: Area[] = [
  { city: 'Dhaka', name: 'Dhanmondi', latitude: 23.7461, longitude: 90.3742 },
  { city: 'Dhaka', name: 'Dhanmondi 27', latitude: 23.7543, longitude: 90.3733, aliases: ['dhanmondi 27'] },
  { city: 'Dhaka', name: 'Jigatola', latitude: 23.738, longitude: 90.373 },
  { city: 'Dhaka', name: 'Lalmatia', latitude: 23.7546, longitude: 90.3698 },
  { city: 'Dhaka', name: 'Mohammadpur', latitude: 23.7566, longitude: 90.3642 },
  { city: 'Dhaka', name: 'Shyamoli', latitude: 23.7736, longitude: 90.361 },
  { city: 'Dhaka', name: 'Kallyanpur', latitude: 23.781, longitude: 90.36 },
  { city: 'Dhaka', name: 'Mirpur DOHS', latitude: 23.8292, longitude: 90.3598, aliases: ['mirpur dohs'] },
  { city: 'Dhaka', name: 'Mirpur', latitude: 23.8069, longitude: 90.3687, aliases: ['mirpur 1', 'mirpur 10', 'mirpur 11'] },
  { city: 'Dhaka', name: 'Kazipara', latitude: 23.798, longitude: 90.37 },
  { city: 'Dhaka', name: 'Shewrapara', latitude: 23.793, longitude: 90.371 },
  { city: 'Dhaka', name: 'Agargaon', latitude: 23.777, longitude: 90.38 },
  { city: 'Dhaka', name: 'Pallabi', latitude: 23.825, longitude: 90.362 },
  { city: 'Dhaka', name: 'TSC', latitude: 23.7389, longitude: 90.3956, aliases: ['dhaka university', 'du campus'] },
  { city: 'Dhaka', name: 'Shahbagh', latitude: 23.7384, longitude: 90.3959 },
  { city: 'Dhaka', name: 'Farmgate', latitude: 23.756, longitude: 90.39 },
  { city: 'Dhaka', name: 'Green Road', latitude: 23.75, longitude: 90.386 },
  { city: 'Dhaka', name: 'Tejgaon', latitude: 23.764, longitude: 90.399 },
  { city: 'Dhaka', name: 'Azimpur', latitude: 23.729, longitude: 90.387 },
  { city: 'Dhaka', name: 'Lalbagh', latitude: 23.719, longitude: 90.388, aliases: ['old dhaka', 'puran dhaka'] },
  { city: 'Dhaka', name: 'Hazaribagh', latitude: 23.735, longitude: 90.362 },
  { city: 'Dhaka', name: 'Rayer Bazar', latitude: 23.742, longitude: 90.362 },
  { city: 'Dhaka', name: 'Moghbazar', latitude: 23.746, longitude: 90.406 },
  { city: 'Dhaka', name: 'Malibagh', latitude: 23.746, longitude: 90.417 },
  { city: 'Dhaka', name: 'Motijheel', latitude: 23.728, longitude: 90.417 },
  { city: 'Dhaka', name: 'Paltan', latitude: 23.733, longitude: 90.413 },
  { city: 'Dhaka', name: 'Khilgaon', latitude: 23.746, longitude: 90.427 },
  { city: 'Dhaka', name: 'Banasree', latitude: 23.763, longitude: 90.433 },
  { city: 'Dhaka', name: 'Rampura', latitude: 23.7637, longitude: 90.42 },
  { city: 'Dhaka', name: 'Badda', latitude: 23.7787, longitude: 90.4264 },
  { city: 'Dhaka', name: 'Gulshan 1', latitude: 23.7806, longitude: 90.4154, aliases: ['gulshan 1'] },
  { city: 'Dhaka', name: 'Gulshan 2', latitude: 23.7936, longitude: 90.4143, aliases: ['gulshan 2', 'gulshan'] },
  { city: 'Dhaka', name: 'Banani', latitude: 23.7936, longitude: 90.4043 },
  { city: 'Dhaka', name: 'Nikunja', latitude: 23.822, longitude: 90.417 },
  { city: 'Dhaka', name: 'Baridhara', latitude: 23.802, longitude: 90.421 },
  { city: 'Dhaka', name: 'Bashundhara R/A', latitude: 23.8223, longitude: 90.4264, aliases: ['bashundhara residential area', 'bashundhara'] },
  { city: 'Dhaka', name: 'Uttara Sector 7', latitude: 23.8721, longitude: 90.3876, aliases: ['uttara sector 7', 'uttara'] },
  { city: 'Dhaka', name: 'Uttara Sector 4', latitude: 23.865, longitude: 90.396 },

  { city: 'Chattogram', name: 'Chattogram', latitude: 22.3569, longitude: 91.7832, aliases: ['chittagong'] },
  { city: 'Chattogram', name: 'Agrabad', latitude: 22.3272, longitude: 91.8056 },
  { city: 'Sylhet', name: 'Sylhet', latitude: 24.8949, longitude: 91.8687 },
  { city: 'Khulna', name: 'Khulna', latitude: 22.8456, longitude: 89.5403 },
  { city: 'Rajshahi', name: 'Rajshahi', latitude: 24.3745, longitude: 88.6042 },
  { city: 'Barishal', name: 'Barishal', latitude: 22.701, longitude: 90.3535, aliases: ['barisal'] },
  { city: 'Rangpur', name: 'Rangpur', latitude: 25.7439, longitude: 89.2752 },
  { city: 'Mymensingh', name: 'Mymensingh', latitude: 24.7471, longitude: 90.4203 },
  { city: "Cox's Bazar", name: "Cox's Bazar", latitude: 21.4272, longitude: 92.0058, aliases: ["cox's bazar", 'coxs bazar'] },
  { city: 'Cumilla', name: 'Cumilla', latitude: 23.4607, longitude: 91.1809, aliases: ['comilla'] },
  { city: 'Narayanganj', name: 'Narayanganj', latitude: 23.6238, longitude: 90.5 },
  { city: 'Gazipur', name: 'Gazipur', latitude: 23.9999, longitude: 90.4203 },
  { city: 'Bogura', name: 'Bogura', latitude: 24.8465, longitude: 89.3773, aliases: ['bogra'] },
];

/** Cities that get their own heading in the picker, in a stable order. */
export const AREA_CITIES: string[] = Array.from(new Set(AREAS.map((area) => area.city)));

export function normalizeAreaName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const AREA_MATCH_KEYS: { key: string; area: Area }[] = AREAS.flatMap((area) =>
  [area.name, ...(area.aliases ?? [])].map((variant) => ({
    key: normalizeAreaName(variant),
    area,
  })),
).sort((a, b) => b.key.length - a.key.length);

/**
 * Resolves a stored free-text area ("Mirpur DOHS, Dhaka") to catalogue
 * coordinates. Longest match wins so "Mirpur DOHS" beats "Mirpur".
 */
export function findArea(label: string | null | undefined): Area | undefined {
  if (!label) return undefined;
  const haystack = ` ${normalizeAreaName(label)} `;
  return AREA_MATCH_KEYS.find(({ key }) => key.length > 0 && haystack.includes(` ${key} `))?.area;
}

export function coordsForAreaLabel(label: string | null | undefined): Coords | undefined {
  const area = findArea(label);
  return area ? { latitude: area.latitude, longitude: area.longitude } : undefined;
}

/** Case-insensitive area search; name-prefix matches rank first. */
export function searchAreas(query: string, limit = 40): Area[] {
  const needle = normalizeAreaName(query);
  if (!needle) return AREAS.slice(0, limit);
  const scored = AREAS.map((area) => {
    const name = normalizeAreaName(area.name);
    const city = normalizeAreaName(area.city);
    if (name.startsWith(needle)) return { area, rank: 0 };
    if (name.includes(needle)) return { area, rank: 1 };
    if (city.includes(needle) || normalizeAreaName(area.aliases?.join(' ') ?? '').includes(needle))
      return { area, rank: 2 };
    return null;
  }).filter((entry): entry is { area: Area; rank: number } => entry !== null);
  scored.sort((a, b) => a.rank - b.rank || a.area.name.localeCompare(b.area.name));
  return scored.slice(0, limit).map((entry) => entry.area);
}

/**
 * Turns a reverse-geocoded address into something short enough for the header,
 * e.g. "Dhanmondi, Dhaka" rather than the full street address.
 */
export function formatAreaLabel(address: {
  name?: string | null;
  street?: string | null;
  district?: string | null;
  city?: string | null;
  subregion?: string | null;
  region?: string | null;
} | null): string | null {
  if (!address) return null;
  const locality =
    address.district || address.name || address.street || address.subregion || null;
  const city = address.city || address.region || null;
  if (locality && city && locality !== city) return `${locality}, ${city}`;
  return locality || city || null;
}

/**
 * Nearest catalogue area to a coordinate pair. Used to give GPS fixes a
 * friendly name when reverse geocoding fails or is unavailable.
 */
export function nearestArea(coords: Coords): { area: Area; km: number } {
  let best: { area: Area; km: number } = { area: AREAS[0], km: Number.POSITIVE_INFINITY };
  for (const area of AREAS) {
    const km = haversineKm(coords, area);
    if (km < best.km) best = { area, km };
  }
  return best;
}

/**
 * How close a fix has to be to a curated area before we name it after that
 * area. Further out we trust the platform geocoder rather than guessing.
 */
const CATALOGUE_SNAP_KM = 8;

/**
 * Turns a coordinate pair into a friendly label.
 *
 * Inside a known area we use the curated name ("Dhanmondi, Dhaka") so a GPS fix
 * labels a listing the same way the picker, the chips and search do — and so a
 * public "pickup area" never leaks a house number. Anything further from the
 * catalogue keeps whatever the platform geocoder produced.
 */
export function describeCoords(coords: Coords, geocoded: string | null): string | null {
  const { area, km } = nearestArea(coords);
  if (Number.isFinite(km) && km <= CATALOGUE_SNAP_KM) {
    return `${area.name}, ${area.city}`;
  }
  return geocoded;
}

/** Web link for a coordinate pair — opens the user's maps app or a browser. */
export function mapsUrl(coords: Coords): string {
  return `https://www.google.com/maps/search/?api=1&query=${coords.latitude},${coords.longitude}`;
}

/** Platform URL scheme that hands off to the installed maps app. */
export function nativeMapsUrl(coords: Coords, label: string | null, platform: string): string {
  if (platform === 'ios') {
    const query = label
      ? encodeURIComponent(label)
      : `${coords.latitude},${coords.longitude}`;
    return `maps:?ll=${coords.latitude},${coords.longitude}&q=${query}`;
  }
  const name = label ? `(${encodeURIComponent(label)})` : '';
  return `geo:${coords.latitude},${coords.longitude}?q=${coords.latitude},${coords.longitude}${name}`;
}

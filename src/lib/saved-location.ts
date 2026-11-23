import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The user's chosen location and search radius, persisted across launches.
 *
 * Kept as a tiny module-level store (same approach as `lib/onboarding.ts`) so
 * the header, Home, Search and the picker all read one shared value and update
 * together the moment the user changes it.
 */

export type LocationSource = 'gps' | 'manual' | 'default';

export interface SavedLocation {
  /** Friendly label, e.g. "Dhanmondi, Dhaka". */
  label: string;
  latitude: number;
  longitude: number;
  /** `gps` = read from the device, `manual` = picked from the catalogue. */
  source: LocationSource;
  /** Epoch ms of the fix or choice. */
  updatedAt: number;
}

interface LocationState {
  /** null until the user (or GPS) has actually established a place. */
  location: SavedLocation | null;
  radiusKm: number | null;
  recent: SavedLocation[];
  promptDismissed: boolean;
  hydrated: boolean;
}

const STORAGE_KEY = 'puran-haat:location';
const MAX_RECENT = 4;
export const DEFAULT_RADIUS_KM = 5;

let state: LocationState = {
  location: null,
  radiusKm: DEFAULT_RADIUS_KM,
  recent: [],
  promptDismissed: false,
  hydrated: false,
};

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeLocation(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Stable snapshot for `useSyncExternalStore`. */
export function getLocationState(): LocationState {
  return state;
}

function sameCoords(a: SavedLocation, b: SavedLocation): boolean {
  return (
    Math.abs(a.latitude - b.latitude) < 0.001 && Math.abs(a.longitude - b.longitude) < 0.001
  );
}

function toRecent(entry: SavedLocation, existing: SavedLocation[]): SavedLocation[] {
  return [entry, ...existing.filter((item) => !sameCoords(item, entry))].slice(0, MAX_RECENT);
}

function isSavedLocation(value: unknown): value is SavedLocation {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SavedLocation>;
  return (
    typeof candidate.label === 'string' &&
    typeof candidate.latitude === 'number' &&
    typeof candidate.longitude === 'number' &&
    Number.isFinite(candidate.latitude) &&
    Number.isFinite(candidate.longitude)
  );
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        location: state.location,
        radiusKm: state.radiusKm,
        recent: state.recent,
        promptDismissed: state.promptDismissed,
      }),
    );
  } catch {
    // Storage is best-effort: the in-memory value still works this session.
  }
}

let loadPromise: Promise<void> | null = null;

/** Reads the persisted value once. Safe to call from several screens. */
export function loadSavedLocation(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    let parsed: Record<string, unknown> | null = null;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    } catch {
      parsed = null;
    }

    const location = isSavedLocation(parsed?.location) ? parsed.location : null;
    const radiusRaw = parsed?.radiusKm;
    const radiusKm =
      typeof radiusRaw === 'number' && Number.isFinite(radiusRaw)
        ? radiusRaw
        : radiusRaw === null
          ? null
          : DEFAULT_RADIUS_KM;
    const recent = Array.isArray(parsed?.recent)
      ? (parsed.recent as unknown[]).filter(isSavedLocation).slice(0, MAX_RECENT)
      : [];

    state = {
      location,
      radiusKm,
      recent,
      promptDismissed: parsed?.promptDismissed === true,
      hydrated: true,
    };
    emit();
  })();
  return loadPromise;
}

export function saveLocation(location: SavedLocation): void {
  state = {
    ...state,
    location,
    recent: toRecent(location, state.recent),
    promptDismissed: true,
    hydrated: true,
  };
  emit();
  void persist();
}

export function clearLocation(): void {
  state = { ...state, location: null };
  emit();
  void persist();
}

export function saveRadius(radiusKm: number | null): void {
  state = { ...state, radiusKm };
  emit();
  void persist();
}

export function dismissLocationPrompt(): void {
  if (state.promptDismissed) return;
  state = { ...state, promptDismissed: true };
  emit();
  void persist();
}

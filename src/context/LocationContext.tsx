import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { Item } from '../types';
import {
  coordsForAreaLabel,
  formatDistanceKm,
  formatRadius,
  haversineKm,
  hasCoords,
  roundDistanceKm,
  type Area,
  type Coords,
} from '../lib/geo';
import {
  detectCurrentPlace,
  getPermissionState,
  openInMaps,
  LocationError,
  requestPermission,
  type DetectedPlace,
  type LocationErrorCode,
  type LocationPermissionState,
} from '../lib/location';
import {
  clearLocation,
  dismissLocationPrompt,
  getLocationState,
  loadSavedLocation,
  saveLocation,
  saveRadius,
  subscribeLocation,
  type SavedLocation,
} from '../lib/saved-location';

/** Anything that can be placed on the map. */
type Locatable = {
  location_name?: string;
  latitude?: number;
  longitude?: number;
};

interface LocationContextValue {
  /** The active place, or null while the user has not set one. */
  location: SavedLocation | null;
  /** Distance filter used by Home and Discover. null = no limit. */
  radiusKm: number | null;
  radiusLabel: string;
  /** True once persisted preferences have been read. */
  hydrated: boolean;
  permission: LocationPermissionState;
  /** True while a GPS fix is in flight. */
  detecting: boolean;
  lastError: { code: LocationErrorCode; message: string } | null;
  /** True when the home "turn on location" card has been dismissed. */
  promptDismissed: boolean;
  /** Previously used places, most recent first. */
  recent: SavedLocation[];

  /** Reads the device position and stores it. Never throws. */
  refreshLocation: () => Promise<LocationErrorCode | null>;
  /** Asks for permission without reading a position. */
  requestLocationPermission: () => Promise<LocationPermissionState>;
  /** Uses a catalogue area instead of GPS. */
  setManualArea: (area: Area) => void;
  /** Re-uses a previously saved place. */
  applySavedLocation: (saved: SavedLocation) => void;
  setRadiusKm: (radiusKm: number | null) => void;
  forgetLocation: () => void;
  dismissPrompt: () => void;

  /** Coordinates for anything locatable: explicit first, else its area label. */
  coordsOf: (target: Locatable | null | undefined) => Coords | null;
  /** Real distance in km, or null when it cannot be known. */
  distanceTo: (target: Locatable | null | undefined) => number | null;
  /** Formatted distance ("1.2 km"), or null. */
  distanceLabelTo: (target: Locatable | null | undefined) => string | null;
  /** Returns copies of the items carrying their live distance. */
  annotate: <T extends Item>(items: T[]) => T[];
  /** Nearest-first copy of a list; items without coordinates keep their order. */
  sortByDistance: <T extends Item>(items: T[]) => T[];
  /** Opens the device maps app at a listing. */
  openLocationInMaps: (target: Locatable | null | undefined) => Promise<void>;
}

const LocationContext = createContext<LocationContextValue | undefined>(undefined);

/** Reuse a stored GPS fix without re-reading the radio for this long. */
const FRESH_FIX_WINDOW_MS = 5 * 60 * 1000;
/** Silently re-read a stale GPS fix on launch after this long. */
const SILENT_REFRESH_AFTER_MS = 30 * 60 * 1000;

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [snapshot, setSnapshot] = useState(getLocationState);
  const [permission, setPermission] = useState<LocationPermissionState>('undetermined');
  const [detecting, setDetecting] = useState(false);
  const [lastError, setLastError] = useState<LocationContextValue['lastError']>(null);

  // Single shared store: every screen sees the same place and radius.
  useEffect(() => {
    const unsubscribe = subscribeLocation(() => setSnapshot(getLocationState()));
    void loadSavedLocation();
    return unsubscribe;
  }, []);

  useEffect(() => {
    let cancelled = false;
    getPermissionState().then((next) => {
      if (!cancelled) setPermission(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const store = useCallback((place: Omit<SavedLocation, 'updatedAt'>) => {
    saveLocation({ ...place, updatedAt: Date.now() });
  }, []);

  const refreshLocation = useCallback(async (): Promise<LocationErrorCode | null> => {
    setDetecting(true);
    setLastError(null);
    try {
      const place: DetectedPlace = await detectCurrentPlace({
        acceptCachedWithinMs: FRESH_FIX_WINDOW_MS,
        onLabelResolved: (cached) => {
          // Show the cached fix immediately; the fresh reading replaces it.
          store({
            label: cached.label || 'Current location',
            latitude: cached.coords.latitude,
            longitude: cached.coords.longitude,
            source: 'gps',
          });
        },
      });
      store({
        label: place.label || 'Current location',
        latitude: place.coords.latitude,
        longitude: place.coords.longitude,
        source: 'gps',
      });
      setPermission('granted');
      return null;
    } catch (error) {
      const locationError =
        error instanceof LocationError
          ? error
          : new LocationError('failed', 'Could not get your current location.');
      setLastError({ code: locationError.code, message: locationError.message });
      if (locationError.code === 'permission_denied') {
        setPermission(await getPermissionState());
      }
      return locationError.code;
    } finally {
      setDetecting(false);
    }
  }, [store]);

  const requestLocationPermission = useCallback(async () => {
    const next = await requestPermission();
    setPermission(next);
    if (next === 'granted') setLastError(null);
    return next;
  }, []);

  const setManualArea = useCallback(
    (area: Area) => {
      store({
        label: `${area.name}, ${area.city}`,
        latitude: area.latitude,
        longitude: area.longitude,
        source: 'manual',
      });
      setLastError(null);
    },
    [store],
  );

  const applySavedLocation = useCallback(
    (saved: SavedLocation) => {
      store({
        label: saved.label,
        latitude: saved.latitude,
        longitude: saved.longitude,
        source: saved.source,
      });
      setLastError(null);
    },
    [store],
  );

  const forgetLocation = useCallback(() => {
    clearLocation();
  }, []);

  const dismissPrompt = useCallback(() => {
    dismissLocationPrompt();
  }, []);

  const { location, radiusKm, recent, promptDismissed, hydrated } = snapshot;

  // Silently re-read a stale GPS fix so "km away" stays believable without
  // interrupting anyone. Failures stay quiet — nothing was requested.
  useEffect(() => {
    if (!hydrated || !location) return;
    if (location.source !== 'gps') return;
    if (Date.now() - location.updatedAt < SILENT_REFRESH_AFTER_MS) return;
    let cancelled = false;
    (async () => {
      try {
        const place = await detectCurrentPlace({ acceptCachedWithinMs: FRESH_FIX_WINDOW_MS });
        if (cancelled) return;
        saveLocation({
          label: place.label || location.label,
          latitude: place.coords.latitude,
          longitude: place.coords.longitude,
          source: 'gps',
          updatedAt: Date.now(),
        });
      } catch {
        // Keep the previous fix.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, location]);

  const coordsOf = useCallback((target: Locatable | null | undefined): Coords | null => {
    if (!target) return null;
    if (hasCoords(target)) {
      return { latitude: target.latitude as number, longitude: target.longitude as number };
    }
    // Listings saved before coordinates existed still resolve to their area.
    return coordsForAreaLabel(target.location_name) ?? null;
  }, []);

  const origin = useMemo<Coords | null>(
    () => (location ? { latitude: location.latitude, longitude: location.longitude } : null),
    [location],
  );

  const distanceTo = useCallback(
    (target: Locatable | null | undefined): number | null => {
      if (!origin) return null;
      const point = coordsOf(target);
      if (!point) return null;
      return roundDistanceKm(haversineKm(origin, point));
    },
    [coordsOf, origin],
  );

  const distanceLabelTo = useCallback(
    (target: Locatable | null | undefined): string | null => formatDistanceKm(distanceTo(target)),
    [distanceTo],
  );

  const annotate = useCallback(
    <T extends Item>(items: T[]): T[] => {
      if (!origin) {
        return items.map((item) =>
          item.distance_km === undefined ? item : ({ ...item, distance_km: undefined } as T),
        );
      }
      return items.map((item) => {
        const point = coordsOf(item);
        const distance_km = point ? roundDistanceKm(haversineKm(origin, point)) : undefined;
        return item.distance_km === distance_km ? item : ({ ...item, distance_km } as T);
      });
    },
    [coordsOf, origin],
  );

  const sortByDistance = useCallback(
    <T extends Item>(items: T[]): T[] => {
      if (!origin) return items;
      const annotated = annotate(items);
      return [...annotated].sort((a, b) => {
        const left = a.distance_km;
        const right = b.distance_km;
        if (left == null && right == null) return 0;
        if (left == null) return 1;
        if (right == null) return -1;
        return left - right;
      });
    },
    [annotate, origin],
  );

  const openLocationInMaps = useCallback(
    async (target: Locatable | null | undefined) => {
      const point = coordsOf(target);
      if (!point) return;
      await openInMaps(point, target?.location_name ?? null);
    },
    [coordsOf],
  );

  const value = useMemo<LocationContextValue>(
    () => ({
      location,
      radiusKm,
      radiusLabel: formatRadius(radiusKm),
      hydrated,
      permission,
      detecting,
      lastError,
      promptDismissed,
      recent,
      refreshLocation,
      requestLocationPermission,
      setManualArea,
      applySavedLocation,
      setRadiusKm: saveRadius,
      forgetLocation,
      dismissPrompt,
      coordsOf,
      distanceTo,
      distanceLabelTo,
      annotate,
      sortByDistance,
      openLocationInMaps,
    }),
    [
      annotate,
      coordsOf,
      detecting,
      dismissPrompt,
      distanceLabelTo,
      distanceTo,
      forgetLocation,
      hydrated,
      lastError,
      location,
      openLocationInMaps,
      permission,
      promptDismissed,
      radiusKm,
      recent,
      refreshLocation,
      requestLocationPermission,
      setManualArea,
      sortByDistance,
      applySavedLocation,
    ],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
};

export const useLocation = (): LocationContextValue => {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used within LocationProvider');
  return ctx;
};

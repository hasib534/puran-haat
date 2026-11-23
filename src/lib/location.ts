/**
 * Everything that talks to the device: permissions, position fixes and
 * reverse geocoding (plus the maps hand-off helpers that need `Linking`).
 *
 * Screens should go through `useLocation()` in `context/LocationContext`
 * instead of calling this directly — it owns caching, persistence and errors.
 */

import { Linking, Platform } from 'react-native';
import * as Location from 'expo-location';

import { describeCoords, formatAreaLabel, mapsUrl, nativeMapsUrl, type Coords } from './geo';

export type LocationPermissionState =
  | 'undetermined'
  | 'granted'
  | 'denied'
  | 'unavailable';

export type LocationErrorCode =
  | 'permission_denied'
  | 'services_disabled'
  | 'timeout'
  | 'unsupported'
  | 'failed';

export class LocationError extends Error {
  code: LocationErrorCode;

  constructor(code: LocationErrorCode, message: string) {
    super(message);
    this.name = 'LocationError';
    this.code = code;
  }
}

export interface DetectedPlace {
  coords: Coords;
  /** Friendly locality label, e.g. "Dhanmondi, Dhaka". */
  label: string;
  /** Radius of uncertainty in metres, when the platform reports one. */
  accuracyM: number | null;
}

/** How long we are willing to wait for a fresh GPS fix before giving up. */
const FIX_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new LocationError('timeout', 'Getting your location took too long.')),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function getPermissionState(): Promise<LocationPermissionState> {
  try {
    const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
    if (status === 'granted') return 'granted';
    return canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'unavailable';
  }
}

/**
 * Asks for foreground permission. Resolves to the resulting state rather than
 * throwing, so callers can render a "denied" panel instead of an error.
 */
export async function requestPermission(): Promise<LocationPermissionState> {
  try {
    const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') return 'granted';
    return canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'unavailable';
  }
}

export async function areServicesEnabled(): Promise<boolean> {
  try {
    return await Location.hasServicesEnabledAsync();
  } catch {
    return false;
  }
}

/**
 * Android-only nudge that opens the "turn on high accuracy" system dialog.
 * Resolves false when the user declines, so the caller can point at Settings.
 */
export async function promptForServices(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    await Location.enableNetworkProviderAsync();
    return true;
  } catch {
    return false;
  }
}

/**
 * Names a coordinate pair. Prefers the platform geocoder and falls back to null
 * (the caller then uses the nearest catalogue area).
 */
export async function reverseGeocodeLabel(coords: Coords): Promise<string | null> {
  try {
    const [address] = await Location.reverseGeocodeAsync(coords);
    return formatAreaLabel(address ?? null);
  } catch {
    return null;
  }
}

export interface DetectOptions {
  /** Reuse a cached fix for this long so repeat taps feel instant. */
  acceptCachedWithinMs?: number;
  onLabelResolved?: (place: DetectedPlace) => void;
}

/**
 * Produces a usable place: cached fix first (instant), then a fresh GPS read.
 * Throws `LocationError` with a code the UI can act on.
 */
export async function detectCurrentPlace(options: DetectOptions = {}): Promise<DetectedPlace> {
  const permission = await getPermissionState();
  if (permission === 'unavailable') {
    throw new LocationError('unsupported', 'Location is not available on this device.');
  }
  if (permission !== 'granted') {
    throw new LocationError('permission_denied', 'Location permission is needed.');
  }
  if (!(await areServicesEnabled())) {
    throw new LocationError('services_disabled', 'Location services are turned off.');
  }

  const cached = await withTimeout(
    Location.getLastKnownPositionAsync({
      maxAge: options.acceptCachedWithinMs ?? 60_000,
      requiredAccuracy: 5000,
    }),
    3000,
  ).catch(() => null);

  const first = cached ?? null;
  let place: DetectedPlace | null = null;

  if (first) {
    place = {
      coords: { latitude: first.coords.latitude, longitude: first.coords.longitude },
      label: '',
      accuracyM: first.coords.accuracy ?? null,
    };
    // Show the cached position straight away, then refine it below. Even an
    // unnamed fix is useful: it already means "you are roughly here".
    const cachedLabel = describeCoords(place.coords, await reverseGeocodeLabel(place.coords));
    if (cachedLabel) place.label = cachedLabel;
    options.onLabelResolved?.({ ...place });
  }

  try {
    const fresh = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      FIX_TIMEOUT_MS,
    );
    const coords = { latitude: fresh.coords.latitude, longitude: fresh.coords.longitude };
    const label =
      describeCoords(coords, await reverseGeocodeLabel(coords)) || place?.label || '';
    return { coords, label, accuracyM: fresh.coords.accuracy ?? null };
  } catch (error) {
    if (place) {
      return { ...place, label: place.label };
    }
    if (error instanceof LocationError) throw error;
    throw new LocationError('failed', 'Could not get your current location.');
  }
}

/** Hands the coordinates to the native maps app, falling back to the browser. */
export async function openInMaps(coords: Coords, label: string | null): Promise<void> {
  const native = nativeMapsUrl(coords, label, Platform.OS);
  try {
    await Linking.openURL(native);
  } catch {
    await Linking.openURL(mapsUrl(coords));
  }
}

/** Opens the OS settings page for this app (used after a denied permission). */
export async function openAppSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // Nothing sensible to do if even Settings cannot be opened.
  }
}

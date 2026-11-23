import { useCallback, useState } from 'react';

import { nearestArea, type Coords } from '../lib/geo';
import {
  detectCurrentPlace,
  LocationError,
  requestPermission,
  type LocationPermissionState,
} from '../lib/location';
import { showAlert } from '../lib/alert';

export interface CapturedPlace {
  /** Ready-to-store area label, e.g. "Dhanmondi, Dhaka". */
  label: string;
  coords: Coords;
  /** Metres of uncertainty when the platform reports it. */
  accuracyM: number | null;
}

/**
 * "Use my current location" for the forms that save a place (posting an item,
 * editing a listing, editing the profile).
 *
 * Resolves to null when the user declines or the device cannot produce a fix —
 * the caller keeps whatever the person typed, so a form is never blocked on GPS.
 */
export function useCaptureLocation() {
  const [capturing, setCapturing] = useState(false);

  const capture = useCallback(async (): Promise<CapturedPlace | null> => {
    if (capturing) return null;
    setCapturing(true);
    try {
      const permission: LocationPermissionState = await requestPermission();
      if (permission === 'denied') {
        showAlert(
          'Location permission is off',
          'Turn on location for Puran Haat in Settings, or type the area by hand.',
        );
        return null;
      }
      if (permission === 'unavailable') {
        showAlert(
          'Location unavailable',
          'This device cannot report a location. Type the area by hand instead.',
        );
        return null;
      }

      const place = await detectCurrentPlace();
      const fallback = nearestArea(place.coords);
      return {
        label: place.label || `${fallback.area.name}, ${fallback.area.city}`,
        coords: place.coords,
        accuracyM: place.accuracyM,
      };
    } catch (error) {
      const message =
        error instanceof LocationError
          ? error.message
          : 'Could not read your location. Type the area by hand instead.';
      showAlert('Could not use your location', message);
      return null;
    } finally {
      setCapturing(false);
    }
  }, [capturing]);

  return { capture, capturing };
}
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { isFirebaseConfigured, setPresence } from '../lib/firebase';

/** How often a signed-in client refreshes its "online" heartbeat. */
const HEARTBEAT_MS = 25_000;

/**
 * Keeps `presence/{uid}` current for the signed-in trader: online while the app
 * is in the foreground, offline as soon as it is backgrounded, with a periodic
 * `last_seen` refresh so readers can age out a client that vanished without
 * cleaning up. Inert in demo mode and while signed out.
 */
export function usePresenceHeartbeat(uid?: string): void {
  // Read the latest uid from cleanup without re-subscribing on every render.
  const uidRef = useRef(uid);
  useEffect(() => {
    uidRef.current = uid;
  }, [uid]);

  useEffect(() => {
    if (!isFirebaseConfigured || !uid) return;

    const markOnline = () => {
      setPresence(uid, true).catch((error) =>
        console.warn('Presence update failed:', (error as Error).message),
      );
    };

    const markOffline = () => {
      setPresence(uid, false).catch(() => {});
    };

    markOnline();
    const heartbeat = setInterval(markOnline, HEARTBEAT_MS);

    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') markOnline();
      else markOffline();
    });

    return () => {
      clearInterval(heartbeat);
      subscription.remove();
      // Fire-and-forget: cleanup cannot await, and the row simply ages out if
      // this write never lands.
      if (uidRef.current) setPresence(uidRef.current, false).catch(() => {});
    };
  }, [uid]);
}

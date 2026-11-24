import { useEffect } from 'react';
import { Platform } from 'react-native';

import { registerPushToken } from '../lib/firebase';
import { configurePushNotifications, getPushToken, rememberPushToken } from '../lib/push';

/**
 * Registers this device for push once a trader is signed in, and keeps the
 * stored token fresh if the provider rotates it.
 *
 * Tokens are collected even before a Worker URL is configured: they are
 * harmless to store, and it means delivery starts working the moment the
 * sender is deployed. Inert on web, and it never blocks the normal app flow.
 */
export function usePushRegistration(uid?: string): void {
  useEffect(() => {
    if (Platform.OS === 'web' || !uid) return;

    let cancelled = false;
    let tokenSubscription: { remove: () => void } | undefined;

    (async () => {
      await configurePushNotifications();

      const token = await getPushToken().catch((error) => {
        console.warn('Could not get push token:', (error as Error).message);
        return null;
      });
      if (token && !cancelled) {
        await registerPushToken(uid, token).catch((error) =>
          console.warn('Could not save push token:', (error as Error).message),
        );
      }

      // A rotated token invalidates the old one; store the replacement.
      try {
        const Notifications = await import('expo-notifications');
        if (cancelled) return;
        tokenSubscription = Notifications.addPushTokenListener((next) => {
          const value = typeof next.data === 'string' ? next.data : null;
          if (!value) return;
          rememberPushToken(value);
          registerPushToken(uid, value).catch(() => {});
        });
      } catch {
        // Module unavailable (web) — nothing to listen for.
      }
    })();

    return () => {
      cancelled = true;
      tokenSubscription?.remove();
    };
  }, [uid]);
}
// Push notifications without Firebase Blaze.
//
// The app never sends pushes itself. It stores a per-device token in the
// private `pushTokens/{uid}` collection and, when a message is sent, pings a
// small Cloudflare Worker (see `push-worker/`). The Worker authenticates the
// caller, looks up the recipient's tokens, and delivers through either the
// Expo Push Service (when an EAS project ID is configured) or FCM/APNs
// directly (no Expo account needed). Neither path requires Cloud Functions.
//
// Configure with:
//   EXPO_PUBLIC_PUSH_WORKER_URL  — the deployed Worker URL
//   EXPO_PUBLIC_EAS_PROJECT_ID   — optional; enables Expo push tokens

import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { auth } from './firebase';

const WORKER_URL = (process.env.EXPO_PUBLIC_PUSH_WORKER_URL || '').trim();
const EAS_PROJECT_ID = (process.env.EXPO_PUBLIC_EAS_PROJECT_ID || '').trim();

/** Android notification channel shared by the client and the Worker payload. */
export const PUSH_CHANNEL_ID = 'messages';

/** True when a push sender is configured; without it everything stays inert. */
export const isPushConfigured = Boolean(WORKER_URL);

type NotificationsModule = typeof import('expo-notifications');

/**
 * `expo-notifications` is native-only. Load it lazily so the web bundle and
 * any platform without the module degrade to a no-op instead of crashing.
 */
async function loadNotifications(): Promise<NotificationsModule | null> {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

function expoProjectId(): string | undefined {
  return (
    EAS_PROJECT_ID ||
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.easConfig?.projectId ||
    undefined
  );
}

/**
 * Installs the foreground handler and the Android channel. Safe to call more
 * than once; the newest handler simply replaces the previous one.
 */
export async function configurePushNotifications(): Promise<void> {
  const Notifications = await loadNotifications();
  if (!Notifications) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  await ensureMessageChannel(Notifications);
}

/**
 * Creates the Android channel the Worker targets (`channel_id: messages`).
 * Android 13+ will not show the permission prompt until a channel exists, so
 * this runs before requesting permission too. Recreating an existing channel
 * only updates it. `sound` is deliberately omitted — the channel then uses the
 * device's default notification sound, whereas any string here is treated as a
 * bundled sound filename.
 */
async function ensureMessageChannel(Notifications: NotificationsModule): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
    name: 'Messages',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#154212',
  });
}

/**
 * Asks for permission (once) and returns this device's push token. Prefers an
 * Expo token when an EAS project is configured, otherwise falls back to the
 * native FCM/APNs token — which the Worker sends to directly.
 */
export async function getPushToken(): Promise<string | null> {
  const Notifications = await loadNotifications();
  if (!Notifications) return null;

  // Android 13+ will not show the permission prompt until a channel exists.
  await ensureMessageChannel(Notifications);

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return null;

  const projectId = expoProjectId();
  if (projectId) {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  }

  const device = await Notifications.getDevicePushTokenAsync();
  return typeof device.data === 'string' ? device.data : null;
}

/**
 * Tells the Worker that a message just landed in `conversationId`. The Worker
 * derives the sender, recipient and preview from Firestore, so the client only
 * supplies the thread id. Never throws — a failed ping must not block sending.
 */
export async function notifyConversationMessage(conversationId: string): Promise<void> {
  if (!WORKER_URL || !conversationId) return;
  const user = auth?.currentUser;
  if (!user) return;
  try {
    const idToken = await user.getIdToken();
    await fetch(WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ conversationId }),
    });
  } catch (error) {
    console.warn('Push notification ping failed:', (error as Error).message);
  }
}

/**
 * Watches for taps on delivered notifications and forwards the deep-link path
 * carried in `data.url` (the Worker sets `/chat/<id>`).
 */
export async function observeNotificationTaps(
  onUrl: (url: string) => void,
): Promise<() => void> {
  const Notifications = await loadNotifications();
  if (!Notifications) return () => {};

  const redirect = (response: { notification?: { request?: { content?: { data?: unknown } } } } | null) => {
    const data = response?.notification?.request?.content?.data as
      | { url?: unknown }
      | undefined;
    if (typeof data?.url === 'string') onUrl(data.url);
  };

  const last = await Notifications.getLastNotificationResponseAsync();
  if (last) redirect(last);

  const subscription = Notifications.addNotificationResponseReceivedListener((response) =>
    redirect(response),
  );
  return () => subscription.remove();
}
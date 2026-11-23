# Puran Haat push worker

A single Cloudflare Worker that delivers chat push notifications **without
Firebase Blaze**. Cloud Functions need Blaze; this Worker runs on Cloudflare's
free tier and talks to either the Expo Push Service or FCM directly.

The app stores each device's token in the private `pushTokens/{uid}` Firestore
collection and, after a message is sent, pings this Worker with the
conversation id and the sender's Firebase ID token. The Worker verifies the
caller, finds the other participant, reads their tokens, and sends the push.

```
app ──(ID token + conversationId)──► Worker ──► Expo Push / FCM ──► device
                                        └──► Firestore (Admin, read tokens)
```

## One-time setup

1. **Enable the Google APIs** for the `puran-haat-app` project (Google Cloud
   Console → APIs & Services → Enable):
   - *Firebase Cloud Messaging API*
   - *Cloud Firestore API*
2. **Create a service account key**: Firebase Console → Project settings →
   Service accounts → *Generate new private key*. The account needs
   **Cloud Datastore User** and **Firebase Cloud Messaging API Admin**.
3. **Install and deploy**:

   ```sh
   cd push-worker
   npm install
   npx wrangler login
   npx wrangler secret put FIREBASE_SERVICE_ACCOUNT   # paste the JSON file
   npx wrangler deploy
   ```

4. **Point the app at it**. Add the printed Worker URL to `.env.local`:

   ```sh
   EXPO_PUBLIC_PUSH_WORKER_URL=https://puran-haat-push.<account>.workers.dev
   ```

   Restart Metro afterwards. Nothing breaks while the variable is unset — the
   app simply skips token registration and the send ping.

## Which token type?

- **Default (no extra setup):** the app registers the native **FCM/APNs**
  token via `getDevicePushTokenAsync()`. The Worker sends it to FCM directly.
  FCM is free; no Expo account is required.
- **Optional:** set `EXPO_PUBLIC_EAS_PROJECT_ID=<eas project id>` after running
  `eas init`, and the app registers an **Expo push token** instead. The Worker
  detects the token prefix and uses the Expo Push Service.

Both modes share this Worker; you can mix devices.

## Rebuild the app once

`expo-notifications` is a native module, so the existing development build must
be regenerated:

```sh
npx expo prebuild --platform android
npx expo run:android
```

## Testing

```sh
curl https://puran-haat-push.<account>.workers.dev          # {"ok":true,...}

curl -X POST https://puran-haat-push.<account>.workers.dev \
  -H "Authorization: Bearer <firebase id token>" \
  -H "Content-Type: application/json" \
  -d '{"conversationId":"<thread id>"}'
```

The app does the second call automatically after every send. Replies include a
per-token result so you can spot dead tokens.
/**
 * Puran Haat push sender — a single Cloudflare Worker.
 *
 * Why this exists: pushing to a closed app needs something outside the client
 * to call a push provider. Firebase Cloud Functions require the paid Blaze
 * plan, so this Worker (free tier) does it instead. It needs no Blaze and no
 * Expo account.
 *
 * Request contract (from the app):
 *   POST /
 *   Authorization: Bearer <Firebase ID token>
 *   { "conversationId": "..." }
 *
 * The Worker:
 *   1. verifies the caller's Firebase ID token,
 *   2. loads the conversation and proves the caller is a participant,
 *   3. loads the *other* participant's tokens from `pushTokens/{uid}`,
 *   4. sends each token through Expo (if it is an Expo token) or FCM directly.
 *
 * Secrets (wrangler secret put):
 *   FIREBASE_SERVICE_ACCOUNT — the service-account JSON, as a single string.
 *
 * The service account needs the "Cloud Datastore User" and
 * "Firebase Cloud Messaging API" roles. FCM itself is free.
 */

interface Env {
  FIREBASE_SERVICE_ACCOUNT: string;
  /** Optional CORS allow-list; defaults to "*". */
  ALLOWED_ORIGIN?: string;
}

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

// ---------------------------------------------------------------------------
// Small encoding helpers (Workers expose atob/btoa/TextEncoder/crypto.subtle)
// ---------------------------------------------------------------------------

function base64UrlToBytes(input: string) {
  const padded =
    input.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - (input.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function stringToBase64Url(value: string): string {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const normalized = pem.replace(/\\n/g, '\n');
  const body = normalized
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// ---------------------------------------------------------------------------
// Google OAuth (service account -> access token for Firestore + FCM)
// ---------------------------------------------------------------------------

let cachedAccessToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(account: ServiceAccount): Promise<string> {
  const nowMs = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt > nowMs + 60_000) {
    return cachedAccessToken.value;
  }

  const iat = Math.floor(nowMs / 1000);
  const payload = {
    iss: account.client_email,
    scope:
      'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat,
    exp: iat + 3600,
  };

  const unsigned = `${stringToBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${stringToBase64Url(
    JSON.stringify(payload),
  )}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(account.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  );
  const assertion = `${unsigned}.${bytesToBase64Url(new Uint8Array(signature))}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) {
    throw new Error(`OAuth ${response.status}: ${await response.text()}`);
  }
  const json = (await response.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = {
    value: json.access_token,
    expiresAt: nowMs + json.expires_in * 1000,
  };
  return json.access_token;
}

// ---------------------------------------------------------------------------
// Firebase ID-token verification (signature via Google's published JWKs)
// ---------------------------------------------------------------------------

let cachedJwks: { keys: Record<string, JsonWebKey>; expiresAt: number } | null = null;

async function getSigningKeys(): Promise<Record<string, JsonWebKey>> {
  if (cachedJwks && cachedJwks.expiresAt > Date.now()) return cachedJwks.keys;
  const response = await fetch(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  );
  if (!response.ok) throw new Error(`JWKS ${response.status}`);
  const json = (await response.json()) as { keys: Array<JsonWebKey & { kid?: string }> };
  const keys: Record<string, JsonWebKey> = {};
  for (const key of json.keys) {
    if (key.kid) keys[key.kid] = key;
  }
  // Google rotates these; an hour cache is well within their validity.
  cachedJwks = { keys, expiresAt: Date.now() + 60 * 60 * 1000 };
  return keys;
}

interface DecodedToken {
  uid: string;
}

async function verifyIdToken(idToken: string, projectId: string): Promise<DecodedToken> {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const [headerPart, payloadPart, signaturePart] = parts;

  const header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(headerPart))) as {
    kid?: string;
    alg?: string;
  };
  if (!header.kid || header.alg !== 'RS256') throw new Error('Unsupported token header');

  const keys = await getSigningKeys();
  const jwk = keys[header.kid];
  if (!jwk) throw new Error('Unknown signing key');

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    base64UrlToBytes(signaturePart),
    new TextEncoder().encode(`${headerPart}.${payloadPart}`),
  );
  if (!valid) throw new Error('Bad signature');

  const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadPart))) as {
    aud?: string;
    iss?: string;
    sub?: string;
    exp?: number;
    iat?: number;
  };
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId) throw new Error('Wrong audience');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Wrong issuer');
  if (!payload.sub) throw new Error('No subject');
  if (typeof payload.exp === 'number' && payload.exp < now) throw new Error('Expired');

  return { uid: payload.sub };
}

// ---------------------------------------------------------------------------
// Firestore REST reads (Admin credentials bypass security rules)
// ---------------------------------------------------------------------------

type FirestoreValue = Record<string, unknown> | undefined;

function fsString(value: FirestoreValue): string {
  return typeof value?.stringValue === 'string' ? value.stringValue : '';
}

function fsStringList(value: FirestoreValue): string[] {
  const list = value?.arrayValue as { values?: FirestoreValue[] } | undefined;
  return (list?.values || []).map(fsString).filter(Boolean);
}

function fsMap(value: FirestoreValue): Record<string, FirestoreValue> {
  return ((value?.mapValue as { fields?: Record<string, FirestoreValue> } | undefined)?.fields) || {};
}

async function getDocument(
  projectId: string,
  path: string,
  accessToken: string,
): Promise<Record<string, FirestoreValue> | null> {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore ${response.status}: ${await response.text()}`);
  const json = (await response.json()) as { fields?: Record<string, FirestoreValue> };
  return json.fields || {};
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

function isExpoToken(token: string): boolean {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

interface PushPayload {
  title: string;
  body: string;
  data: Record<string, string>;
}

async function sendExpo(token: string, payload: PushPayload): Promise<string> {
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      to: token,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      sound: 'default',
      priority: 'high',
      channelId: 'messages',
    }),
  });
  return response.ok ? 'ok' : `expo ${response.status}`;
}

async function sendFcm(
  projectId: string,
  accessToken: string,
  token: string,
  payload: PushPayload,
): Promise<string> {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: payload.title, body: payload.body },
          // FCM data values must be strings.
          data: payload.data,
          android: {
            priority: 'HIGH',
            notification: { channel_id: 'messages', sound: 'default' },
          },
          apns: {
            payload: { aps: { sound: 'default', badge: 1 } },
          },
        },
      }),
    },
  );
  return response.ok ? 'ok' : `fcm ${response.status}`;
}

// ---------------------------------------------------------------------------
// HTTP entry point
// ---------------------------------------------------------------------------

function corsHeaders(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };
}

function json(body: unknown, status: number, env: Env): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }
    if (request.method === 'GET') {
      return json({ ok: true, service: 'puran-haat-push' }, 200, env);
    }
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, env);
    }

    let account: ServiceAccount;
    try {
      account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as ServiceAccount;
      if (!account.project_id || !account.client_email || !account.private_key) {
        throw new Error('Incomplete service account');
      }
    } catch {
      return json({ error: 'Server is not configured.' }, 500, env);
    }

    const authorization = request.headers.get('Authorization') || '';
    const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!idToken) return json({ error: 'Missing credentials' }, 401, env);

    let callerUid: string;
    try {
      callerUid = (await verifyIdToken(idToken, account.project_id)).uid;
    } catch (error) {
      return json({ error: `Invalid credentials: ${(error as Error).message}` }, 401, env);
    }

    let conversationId = '';
    try {
      const body = (await request.json()) as { conversationId?: unknown };
      conversationId = typeof body.conversationId === 'string' ? body.conversationId : '';
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, env);
    }
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(conversationId)) {
      return json({ error: 'Invalid conversationId' }, 400, env);
    }

    try {
      const accessToken = await getAccessToken(account);

      const conversation = await getDocument(
        account.project_id,
        `conversations/${conversationId}`,
        accessToken,
      );
      if (!conversation) return json({ sent: 0, reason: 'no-conversation' }, 200, env);

      const participants = fsStringList(conversation.participants);
      if (!participants.includes(callerUid)) {
        return json({ error: 'Not a participant' }, 403, env);
      }
      const recipientUid = participants.find((uid) => uid !== callerUid);
      if (!recipientUid) return json({ sent: 0, reason: 'no-recipient' }, 200, env);

      const registrations = await getDocument(
        account.project_id,
        `pushTokens/${recipientUid}`,
        accessToken,
      );
      const tokens = fsStringList(registrations?.tokens);
      if (tokens.length === 0) return json({ sent: 0, reason: 'no-tokens' }, 200, env);

      const profiles = fsMap(conversation.profiles);
      const senderName = fsString(fsMap(profiles[callerUid]).full_name) || 'A trader';
      const lastMessage = fsString(conversation.lastMessage) || 'New message';
      const itemTitle = fsString(conversation.itemTitle);

      const payload: PushPayload = {
        title: senderName,
        body: lastMessage.length > 180 ? `${lastMessage.slice(0, 177)}...` : lastMessage,
        data: {
          url: `/chat/${conversationId}`,
          conversationId,
          ...(itemTitle ? { itemTitle } : {}),
        },
      };

      const results = await Promise.all(
        tokens.map((token) =>
          isExpoToken(token)
            ? sendExpo(token, payload)
            : sendFcm(account.project_id, accessToken, token, payload),
        ),
      );

      return json(
        { sent: results.filter((result) => result === 'ok').length, results },
        200,
        env,
      );
    } catch (error) {
      return json({ error: (error as Error).message }, 500, env);
    }
  },
};
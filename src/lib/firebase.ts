// Firebase client built on the official Firebase JS SDK.
// Configure via .env.local:
//   EXPO_PUBLIC_FIREBASE_API_KEY
//   EXPO_PUBLIC_FIREBASE_PROJECT_ID
//   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET (optional)
//
// Image uploads (listing photos and avatars) go through Cloudinary — see
// src/lib/cloudinary.ts — because Firebase Storage needs a paid plan.
//
// The SDK gives us real-time Firestore listeners plus proper token handling
// that the previous REST-only client could not provide.

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoCrypto from 'expo-crypto';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import type { Auth, Persistence, User } from 'firebase/auth';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getFirestore,
  increment,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import type { Item, Profile } from '../types';

const API_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '';
const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '';
const STORAGE_BUCKET = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '';

export const isFirebaseConfigured = Boolean(API_KEY && PROJECT_ID);

// Firebase Auth on React Native needs a cryptographically secure RNG.
// Hermes does not ship one, so wire expo-crypto into the global before the
// SDK initializes.
const globalCrypto = globalThis as typeof globalThis & { crypto?: Crypto };
if (!globalCrypto.crypto) {
  globalCrypto.crypto = {} as Crypto;
}
if (!globalCrypto.crypto.getRandomValues) {
  globalCrypto.crypto.getRandomValues = ((array: Uint8Array) =>
    ExpoCrypto.getRandomValues(array)) as Crypto['getRandomValues'];
}
if (!globalCrypto.crypto.randomUUID) {
  globalCrypto.crypto.randomUUID = (() => ExpoCrypto.randomUUID()) as Crypto['randomUUID'];
}

export const firebaseApp: FirebaseApp | null = isFirebaseConfigured
  ? getApps().length > 0
    ? getApp()
    : initializeApp({
        apiKey: API_KEY,
        authDomain: `${PROJECT_ID}.firebaseapp.com`,
        projectId: PROJECT_ID,
        storageBucket: STORAGE_BUCKET || undefined,
      })
  : null;

// `firebase/auth` re-exports the React Native persistence helper at runtime
// (Metro resolves the `react-native` condition) but its bundled web typings
// omit it. Read it through a narrow cast instead of relying on those typings.
const getReactNativePersistence = (
  FirebaseAuth as unknown as {
    getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence;
  }
).getReactNativePersistence;

function createAuth(app: FirebaseApp): Auth {
  // On web we let Firebase use its default browser persistence.
  if (Platform.OS === 'web' || !getReactNativePersistence) {
    return FirebaseAuth.getAuth(app);
  }
  try {
    return FirebaseAuth.initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // initializeAuth throws if called twice (Fast Refresh). Fall back to the
    // already-initialized instance.
    return FirebaseAuth.getAuth(app);
  }
}

export const auth: Auth | null = firebaseApp ? createAuth(firebaseApp) : null;
export const db: Firestore | null = firebaseApp ? getFirestore(firebaseApp) : null;

export interface FirebaseUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  /** True for a guest session created with Firebase Anonymous Auth. */
  isAnonymous: boolean;
}

export function mapUser(user: User | null): FirebaseUser | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    emailVerified: user.emailVerified,
    isAnonymous: user.isAnonymous,
  };
}

function requireAuth(): Auth {
  if (!auth) throw new Error('Firebase is not configured. Add your credentials to .env.local.');
  return auth;
}

export function authErrorMessage(error: unknown): string {
  const err = error as { code?: string; message?: string } | null;
  const code = err?.code || '';
  const messages: Record<string, string> = {
    'auth/api-key-not-valid': 'Your Firebase API key is invalid. Check .env.local and restart Expo.',
    'auth/invalid-api-key': 'Your Firebase API key is invalid. Check .env.local and restart Expo.',
    'auth/email-already-in-use': 'An account already exists with this email. Try signing in instead.',
    'auth/invalid-email': 'That email address is not valid.',
    'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Try again.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error. Check your internet connection.',
    'auth/operation-not-allowed': 'This sign-in method is disabled. Enable it in Firebase Console → Authentication.',
    'auth/admin-restricted-operation': 'This sign-in method is disabled. Enable it in Firebase Console → Authentication.',
    'auth/credential-already-in-use': 'These credentials are already used by another account. Sign in instead.',
    'auth/provider-already-linked': 'This account is already linked to that provider.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/requires-recent-login': 'Please sign in again to continue.',
    // The same email is registered under a different sign-in method. Firebase
    // refuses to silently merge them, so point the user at the method they
    // already used instead of leaking the raw SDK sentence.
    'auth/account-exists-with-different-credential':
      'This email is already registered with a different sign-in method. Sign in the way you originally created the account (for example with your password), then link Google from your profile.',
    'auth/unauthorized-domain': 'This domain is not authorised for sign-in. Add it under Firebase Console → Authentication → Settings → Authorized domains.',
    'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.',
    'auth/popup-closed-by-user': 'Sign-in was cancelled because the window was closed.',
    'auth/cancelled-popup-request': 'Sign-in was cancelled.',
    'auth/redirect-cancelled-by-user': 'Sign-in was cancelled.',
    'auth/web-storage-unsupported': 'Sign-in needs cookies and site data. Enable them for this site and try again.',
    'auth/internal-error': 'Sign-in could not complete. Please try again.',
    // Native Google Sign-In gaps that surface before Firebase sees them.
    'auth/invalid-credential-token': 'Google returned an invalid token. Check that the client IDs match the Firebase project.',
    'auth/missing-android-pkg-name': 'Google Sign-In is missing the Android package name.',
    'auth/missing-client-identifier':
      'Google Sign-In is not configured for this build. Register this app\u2019s signing SHA-1 in the Firebase project.',
  };
  if (messages[code]) return messages[code];

  // Fall back to the SDK text, minus the noisy "Firebase: " prefix, so an
  // unmapped error is still readable rather than a wall of prose.
  const raw = err?.message?.replace(/^Firebase:\s*/, '').trim();
  return raw || 'Something went wrong. Please try again.';
}

export async function signUp(
  email: string,
  password: string,
  displayName?: string,
): Promise<FirebaseUser> {
  const instance = requireAuth();
  const current = instance.currentUser;
  // A guest upgrading their account keeps the same uid — and therefore their
  // chat history — by linking the new email/password onto the anonymous user
  // instead of creating a fresh account.
  const credential =
    current && current.isAnonymous
      ? await FirebaseAuth.linkWithCredential(
          current,
          FirebaseAuth.EmailAuthProvider.credential(email, password),
        )
      : await FirebaseAuth.createUserWithEmailAndPassword(instance, email, password);
  if (displayName?.trim()) {
    await FirebaseAuth.updateProfile(credential.user, {
      displayName: displayName.trim(),
    });
  }
  try {
    await FirebaseAuth.sendEmailVerification(credential.user);
  } catch {
    // Signup still succeeds even if the verification email fails to send.
  }
  return mapUser(credential.user)!;
}

export async function signIn(email: string, password: string): Promise<FirebaseUser> {
  const credential = await FirebaseAuth.signInWithEmailAndPassword(requireAuth(), email, password);
  return mapUser(credential.user)!;
}

/**
 * Starts a guest session. Anonymous accounts get a real uid so a visitor can
 * browse, chat and favorite before signing up; their activity carries over when
 * they link a real credential (see `signUp` / Google sign-in).
 */
export async function signInAnonymously(): Promise<FirebaseUser> {
  const credential = await FirebaseAuth.signInAnonymously(requireAuth());
  return mapUser(credential.user)!;
}

export async function signOut(): Promise<void> {
  if (!auth) return;
  await FirebaseAuth.signOut(auth);
}

/** True when the credential belongs to an existing account, so linking failed. */
function isCredentialInUse(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code || '';
  return code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use';
}

export async function signInWithGoogleIdToken(googleIdToken: string): Promise<FirebaseUser> {
  const credential = FirebaseAuth.GoogleAuthProvider.credential(googleIdToken);
  const current = auth?.currentUser;
  // Keep the guest's uid (and chats) when the Google account is new to us.
  if (current && current.isAnonymous) {
    try {
      const linked = await FirebaseAuth.linkWithCredential(current, credential);
      return mapUser(linked.user)!;
    } catch (error) {
      if (!isCredentialInUse(error)) throw error;
      // The Google account already exists — fall through and sign into it.
    }
  }
  const result = await FirebaseAuth.signInWithCredential(requireAuth(), credential);
  return mapUser(result.user)!;
}

/**
 * Web Google sign-in through Firebase's own auth handler.
 *
 * The handler redirect URI is pre-authorized on the Firebase OAuth client, so
 * this avoids having to register every localhost/production origin as a
 * separate Google OAuth redirect URI. Native builds use the official Google
 * Sign-In library and the ID-token exchange above instead.
 */
export async function signInWithGooglePopup(): Promise<FirebaseUser> {
  if (Platform.OS !== 'web') {
    throw new Error('Google popup sign-in is only available on web.');
  }
  const provider = new FirebaseAuth.GoogleAuthProvider();
  const current = auth?.currentUser;
  if (current && current.isAnonymous) {
    try {
      const linked = await FirebaseAuth.linkWithPopup(current, provider);
      return mapUser(linked.user)!;
    } catch (error) {
      if (!isCredentialInUse(error)) throw error;
    }
  }
  const result = await FirebaseAuth.signInWithPopup(requireAuth(), provider);
  return mapUser(result.user)!;
}

export async function resendVerificationEmail(): Promise<void> {
  const user = requireAuth().currentUser;
  if (!user) throw new Error('You must be signed in.');
  if (user.emailVerified) return;
  await FirebaseAuth.sendEmailVerification(user);
}

export async function sendPasswordReset(email: string): Promise<void> {
  await FirebaseAuth.sendPasswordResetEmail(requireAuth(), email);
}

export async function refreshCurrentUser(): Promise<FirebaseUser | null> {
  if (!auth?.currentUser) return null;
  await FirebaseAuth.reload(auth.currentUser);
  // Force a token refresh so newly verified email claims and custom claims are
  // visible to Firestore/Storage rules immediately, instead of waiting for the
  // cached ID token to expire.
  await FirebaseAuth.getIdToken(auth.currentUser, true);
  return mapUser(auth.currentUser);
}

export function subscribeToAuth(callback: (user: FirebaseUser | null) => void): Unsubscribe {
  if (!auth) return () => {};
  return FirebaseAuth.onAuthStateChanged(auth, (user) => callback(mapUser(user)));
}

// ---------------------------------------------------------------------------
// Firestore document shapes
// ---------------------------------------------------------------------------

export interface ConversationDoc {
  participants: string[];
  profiles: Record<string, Profile>;
  itemId: string;
  itemTitle: string;
  itemImage: string;
  lastMessage: string;
  lastMessageAt: number;
  unread: Record<string, number>;
  status: 'pending' | 'accepted' | 'declined';
  proposalId?: string;
  proposer_id?: string;
  receiver_id?: string;
  /**
   * Live typing heartbeat, keyed by participant UID. A timestamp is written
   * while that participant types and cleared when they stop, so the other side
   * can show "typing…" only while it is fresh.
   */
  typing?: Record<string, number>;
  /**
   * Read watermark, keyed by participant UID: the timestamp each participant
   * has read their thread up to. The other side uses it for "Seen" receipts.
   */
  reads?: Record<string, number>;
  created_at: number;
}

export interface MessageDoc {
  sender_id: string;
  text: string;
  created_at: number;
}

export interface PresenceDoc {
  online: boolean;
  last_seen: number;
}

/**
 * Private per-trader push registration. Kept in its own collection (not on the
 * profile) so other signed-in users can never read someone else's device
 * tokens. `tokens` holds Expo or native FCM/APNs tokens; the push worker
 * prunes entries the provider reports as dead.
 */
export interface PushTokensDoc {
  tokens: string[];
  updated_at: number;
}

export interface ProposalDoc {
  participants: string[];
  proposer_id: string;
  receiver_id: string;
  proposer: Profile;
  receiver: Profile;
  requested_item_id: string;
  requested_item_title: string;
  requested_item_image: string;
  offered_item_id?: string;
  offered_item_title?: string;
  offered_item_image?: string;
  cash_adjustment: number;
  note: string;
  status: 'pending' | 'accepted' | 'declined' | 'countered' | 'completed';
  conversation_id: string;
  created_at: number;
}

export type FirestoreRecord = { id: string } & Record<string, unknown>;

/** Recursively drops undefined values so Firestore never rejects a write. */
function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.map((entry) => clean(entry)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry !== undefined) out[key] = clean(entry);
    }
    return out as T;
  }
  return value;
}

export function newDocId(collectionName: string): string {
  if (!db) return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return doc(collection(db, collectionName)).id;
}

// ---------------------------------------------------------------------------
// Real-time subscriptions
// ---------------------------------------------------------------------------

function toRecord(snapshot: { id: string; data: () => Record<string, unknown> | undefined }): FirestoreRecord {
  return { id: snapshot.id, ...(snapshot.data() || {}) };
}

export function subscribeToItems(
  callback: (items: FirestoreRecord[]) => void,
  onError?: (error: Error) => void,
  /**
   * Reports whether the latest snapshot came from the local cache, which is how
   * the SDK exposes "the backend is unreachable right now". It is also `true`
   * briefly during the initial sync, so callers should debounce before treating
   * it as offline.
   */
  onCacheStateChange?: (fromCache: boolean) => void,
): Unsubscribe {
  if (!db) return () => {};
  return onSnapshot(
    collection(db, 'items'),
    // Metadata-only events are what tell us when the listener flips between
    // cache and server, including reconnecting after a drop.
    { includeMetadataChanges: true },
    (snapshot) => {
      onCacheStateChange?.(snapshot.metadata.fromCache);
      callback(snapshot.docs.map(toRecord));
    },
    onError,
  );
}

export function subscribeToUserProfile(
  uid: string,
  callback: (profile: FirestoreRecord | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!db) return () => {};
  return onSnapshot(
    doc(db, 'users', uid),
    (snapshot) => callback(snapshot.exists() ? toRecord(snapshot) : null),
    onError,
  );
}

export function subscribeToFavorites(
  uid: string,
  callback: (favorites: FirestoreRecord[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!db) return () => {};
  return onSnapshot(
    query(collection(db, 'favorites'), where('user_id', '==', uid)),
    (snapshot) => callback(snapshot.docs.map(toRecord)),
    onError,
  );
}

export function subscribeToConversations(
  uid: string,
  callback: (conversations: FirestoreRecord[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!db) return () => {};
  return onSnapshot(
    query(collection(db, 'conversations'), where('participants', 'array-contains', uid)),
    (snapshot) => callback(snapshot.docs.map(toRecord)),
    onError,
  );
}

export function subscribeToMessages(
  conversationId: string,
  callback: (messages: FirestoreRecord[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!db) return () => {};
  return onSnapshot(
    collection(db, 'conversations', conversationId, 'messages'),
    (snapshot) => callback(snapshot.docs.map(toRecord)),
    onError,
  );
}

export function subscribeToProposals(
  uid: string,
  callback: (proposals: FirestoreRecord[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!db) return () => {};
  return onSnapshot(
    query(collection(db, 'proposals'), where('participants', 'array-contains', uid)),
    (snapshot) => callback(snapshot.docs.map(toRecord)),
    onError,
  );
}

/**
 * Streams the entire `presence` collection so a chat screen can show an
 * online/last-seen dot without opening one listener per conversation. Presence
 * is deliberately semi-public: any signed-in trader may read it, but only the
 * owner may write their own row (enforced in firestore.rules).
 */
export function subscribeToPresence(
  callback: (rows: FirestoreRecord[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!db) return () => {};
  return onSnapshot(
    collection(db, 'presence'),
    (snapshot) => callback(snapshot.docs.map(toRecord)),
    onError,
  );
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function saveItem(item: Item): Promise<void> {
  if (!db) return;
  const { id, is_favorite: _favorite, ...data } = item;
  await setDoc(doc(db, 'items', id), clean(data), { merge: true });
}

export async function deleteItemDoc(itemId: string): Promise<void> {
  if (!db) return;
  await deleteDoc(doc(db, 'items', itemId));
}

export async function saveUserProfile(uid: string, patch: Partial<Profile>): Promise<void> {
  if (!db) return;
  await setDoc(doc(db, 'users', uid), clean(patch), { merge: true });
}

/**
 * Removes the stored coordinates from a profile. `clean()` strips `undefined`,
 * so a plain patch cannot clear a field; a `deleteField()` sentinel is needed
 * (and must skip `clean()` for the same reason `registerPushToken` does).
 */
export async function clearUserProfileLocation(uid: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'users', uid), {
    latitude: deleteField(),
    longitude: deleteField(),
  });
}

export async function saveFavorite(uid: string, itemId: string, favorite: boolean): Promise<void> {
  if (!db) return;
  const favoriteId = `${uid}_${itemId}`;
  if (favorite) {
    await setDoc(doc(db, 'favorites', favoriteId), clean({
      user_id: uid,
      item_id: itemId,
      created_at: Date.now(),
    }));
  } else {
    await deleteDoc(doc(db, 'favorites', favoriteId));
  }
}

export async function saveConversation(id: string, conversation: ConversationDoc): Promise<void> {
  if (!db) return;
  await setDoc(doc(db, 'conversations', id), clean(conversation));
}

/**
 * Creates a conversation and its opening message in one atomic batch.
 *
 * Writing them separately could leave an empty thread behind if the second
 * write failed (offline, rejected rules): the conversation document would
 * exist with zero messages, so the realtime listener would show a blank chat.
 */
export async function createConversationWithMessage(
  conversationId: string,
  conversation: ConversationDoc,
  senderId: string,
  firstMessage: string,
): Promise<void> {
  if (!db) return;
  const messageId = newDocId('messages');
  const batch = writeBatch(db);
  batch.set(doc(db, 'conversations', conversationId), clean(conversation));
  batch.set(
    doc(db, 'conversations', conversationId, 'messages', messageId),
    clean({ sender_id: senderId, text: firstMessage, created_at: Date.now() } satisfies MessageDoc),
  );
  await batch.commit();
}

/**
 * Creates/replaces a proposal and updates the conversation in one atomic
 * batch, so a declined retry cannot leave a half-written thread behind.
 */
export async function saveProposalWithConversation(params: {
  conversationId: string;
  proposalId: string;
  proposal: ProposalDoc;
  conversation: ConversationDoc;
  conversationPatch?: Partial<ConversationDoc>;
  isNewConversation: boolean;
}): Promise<void> {
  if (!db) return;
  const batch = writeBatch(db);
  batch.set(doc(db, 'proposals', params.proposalId), clean(params.proposal));
  if (params.isNewConversation) {
    batch.set(doc(db, 'conversations', params.conversationId), clean(params.conversation));
  } else {
    batch.update(
      doc(db, 'conversations', params.conversationId),
      clean(params.conversationPatch || {}),
    );
  }
  await batch.commit();
}

/** Accept/decline a proposal and its conversation atomically. */
export async function respondToProposal(
  conversationId: string,
  proposalId: string | undefined,
  status: 'accepted' | 'declined',
): Promise<void> {
  if (!db) return;
  const batch = writeBatch(db);
  batch.update(doc(db, 'conversations', conversationId), { status });
  if (proposalId) {
    batch.update(doc(db, 'proposals', proposalId), { status });
  }
  await batch.commit();
}

export async function updateConversation(id: string, patch: Partial<ConversationDoc>): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'conversations', id), clean(patch));
}

export async function setConversationStatus(
  id: string,
  status: ConversationDoc['status'],
): Promise<void> {
  await updateConversation(id, { status });
}

/**
 * Clears the caller's unread badge and stamps their read watermark so the
 * other participant can show a "Seen" receipt on their last message. Both
 * fields live on the conversation document and are written atomically.
 */
export async function clearConversationUnread(id: string, uid: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'conversations', id), {
    [`unread.${uid}`]: 0,
    [`reads.${uid}`]: Date.now(),
  });
}

/**
 * Publishes or clears the caller's typing heartbeat on a conversation. Only the
 * caller's own key is touched, so neither side can fake the other's typing.
 */
export async function setTyping(
  conversationId: string,
  uid: string,
  isTyping: boolean,
): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'conversations', conversationId), {
    [`typing.${uid}`]: isTyping ? Date.now() : deleteField(),
  });
}

/**
 * Writes the caller's presence row. `last_seen` is always stamped so a stale
 * "online" flag can be aged out by readers if a client dies without marking
 * itself offline.
 */
export async function setPresence(uid: string, online: boolean): Promise<void> {
  if (!db) return;
  await setDoc(
    doc(db, 'presence', uid),
    clean({ online, last_seen: Date.now() } satisfies PresenceDoc),
    { merge: true },
  );
}

/**
 * Adds this device's push token to the caller's private registration doc.
 * `arrayUnion` keeps re-registering idempotent across app launches.
 */
export async function registerPushToken(uid: string, token: string): Promise<void> {
  if (!db || !token) return;
  // Do not run this through `clean`: it would rebuild the FieldValue sentinel
  // into a plain object and Firestore would reject the write.
  await setDoc(
    doc(db, 'pushTokens', uid),
    { tokens: arrayUnion(token), updated_at: Date.now() },
    { merge: true },
  );
}

/** Removes a device token, e.g. when notifications are disabled. */
export async function unregisterPushToken(uid: string, token: string): Promise<void> {
  if (!db || !token) return;
  await setDoc(
    doc(db, 'pushTokens', uid),
    { tokens: arrayRemove(token), updated_at: Date.now() },
    { merge: true },
  );
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  participants: string[],
  text: string,
): Promise<void> {
  if (!db) return;
  const messageId = newDocId('messages');
  const batch = writeBatch(db);
  batch.set(
    doc(db, 'conversations', conversationId, 'messages', messageId),
    clean({ sender_id: senderId, text, created_at: Date.now() } satisfies MessageDoc),
  );

  const updates: Record<string, unknown> = {
    lastMessage: text,
    lastMessageAt: Date.now(),
  };
  for (const participant of participants) {
    updates[`unread.${participant}`] = participant === senderId ? 0 : increment(1);
  }
  batch.update(doc(db, 'conversations', conversationId), updates);
  await batch.commit();
}

/** Writes the sample listings to Firestore with the signed-in user as owner. */
export async function seedItemsToFirestore(
  items: Item[],
  uid: string,
  profile: Profile,
): Promise<void> {
  if (!db) return;
  const batch = writeBatch(db);
  for (const item of items) {
    const { id, is_favorite: _favorite, ...data } = item;
    batch.set(
      doc(db, 'items', id),
      clean({
        ...data,
        user_id: uid,
        user: { ...profile, id: uid },
      }),
      { merge: true },
    );
  }
  await batch.commit();
}

export { STORAGE_BUCKET };

// Firebase client built on the official Firebase JS SDK.
// Configure via .env.local:
//   EXPO_PUBLIC_FIREBASE_API_KEY
//   EXPO_PUBLIC_FIREBASE_PROJECT_ID
//   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET (optional)
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
  collection,
  deleteDoc,
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
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
  type FirebaseStorage,
} from 'firebase/storage';

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
export const storage: FirebaseStorage | null = firebaseApp ? getStorage(firebaseApp) : null;

export interface FirebaseUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

export function mapUser(user: User | null): FirebaseUser | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    emailVerified: user.emailVerified,
  };
}

function requireAuth(): Auth {
  if (!auth) throw new Error('Firebase is not configured. Add your credentials to .env.local.');
  return auth;
}

function requireStorage(): FirebaseStorage {
  if (!storage) throw new Error('Firebase Storage is not configured. Add your credentials to .env.local.');
  return storage;
}

/**
 * Uploads a picked profile image and returns its public download URL.
 * Remote URLs are returned unchanged so existing Google avatars are preserved.
 */
export async function uploadProfileAvatar(uid: string, uri: string): Promise<string> {
  if (/^https?:\/\//i.test(uri)) return uri;

  const response = await fetch(uri);
  const blob = await response.blob();
  const contentType = blob.type || 'image/jpeg';
  const extension = contentType.split('/')[1]?.split('+')[0] || 'jpg';
  const objectRef = ref(requireStorage(), `avatars/${uid}/profile-${Date.now()}.${extension}`);

  await uploadBytes(objectRef, blob, { contentType });
  return getDownloadURL(objectRef);
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
    'auth/operation-not-allowed': 'Email sign-in is disabled. Enable it in Firebase Console → Authentication.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/requires-recent-login': 'Please sign in again to continue.',
  };
  return messages[code] || err?.message || 'Something went wrong. Please try again.';
}

export async function signUp(email: string, password: string): Promise<FirebaseUser> {
  const credential = await FirebaseAuth.createUserWithEmailAndPassword(requireAuth(), email, password);
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

export async function signOut(): Promise<void> {
  if (!auth) return;
  await FirebaseAuth.signOut(auth);
}

export async function signInWithGoogleIdToken(googleIdToken: string): Promise<FirebaseUser> {
  const credential = FirebaseAuth.GoogleAuthProvider.credential(googleIdToken);
  const result = await FirebaseAuth.signInWithCredential(requireAuth(), credential);
  return mapUser(result.user)!;
}

/**
 * Web Google sign-in through Firebase's own auth handler.
 *
 * The handler redirect URI is pre-authorized on the Firebase OAuth client, so
 * this avoids having to register every localhost/production origin as a
 * separate Google OAuth redirect URI. Native builds use expo-auth-session and
 * the ID-token exchange above instead.
 */
export async function signInWithGooglePopup(): Promise<FirebaseUser> {
  if (Platform.OS !== 'web') {
    throw new Error('Google popup sign-in is only available on web.');
  }
  const provider = new FirebaseAuth.GoogleAuthProvider();
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
  created_at: number;
}

export interface MessageDoc {
  sender_id: string;
  text: string;
  created_at: number;
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
): Unsubscribe {
  if (!db) return () => {};
  return onSnapshot(
    collection(db, 'items'),
    (snapshot) => callback(snapshot.docs.map(toRecord)),
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

export async function clearConversationUnread(id: string, uid: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'conversations', id), { [`unread.${uid}`]: 0 });
}

export async function saveProposal(proposalId: string, proposal: ProposalDoc): Promise<void> {
  if (!db) return;
  await setDoc(doc(db, 'proposals', proposalId), clean(proposal));
}

export async function setProposalStatus(
  proposalId: string,
  status: ProposalDoc['status'],
): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'proposals', proposalId), { status });
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

export async function incrementUserStats(uid: string, ecoPoints: number, trades: number): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'users', uid), {
    eco_points: increment(ecoPoints),
    trade_count: increment(trades),
  });
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

import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from './firebase';
import type {
  AuctionRecord,
  Doc,
  Item,
  ModerationReport,
  Profile,
  RewardBadge,
  RewardGrant,
  RewardRule,
  VerificationRequest,
} from './models';

export type RecordCallback = (docs: Doc[]) => void;
export type ErrorCallback = (error: Error) => void;
export type LiveUnsubscribe = () => void;

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

function watch(name: string, callback: RecordCallback, onError?: ErrorCallback): LiveUnsubscribe {
  if (!db) return () => {};
  return onSnapshot(
    collection(db, name),
    (snapshot) => callback(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))),
    (error) => onError?.(error),
  );
}

function watchDoc(
  name: string,
  id: string,
  callback: (record: Doc | null) => void,
  onError?: ErrorCallback,
): LiveUnsubscribe {
  if (!db) return () => {};
  return onSnapshot(
    doc(db, name, id),
    (snapshot) => callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    (error) => onError?.(error),
  );
}

// ---------------------------------------------------------------------------
// Live collections
// ---------------------------------------------------------------------------

export const watchAdmins = (uid: string, cb: (record: Doc | null) => void, onError?: ErrorCallback) =>
  watchDoc('admins', uid, cb, onError);

export const watchUsers = (cb: RecordCallback, onError?: ErrorCallback) =>
  watch('users', cb, onError);

export const watchUser = (uid: string, cb: (record: Doc | null) => void, onError?: ErrorCallback) =>
  watchDoc('users', uid, cb, onError);

export const watchVerifications = (cb: RecordCallback, onError?: ErrorCallback) =>
  watch('verifications', cb, onError);

export const watchVerification = (
  id: string,
  cb: (record: Doc | null) => void,
  onError?: ErrorCallback,
) => watchDoc('verifications', id, cb, onError);

export const watchAuction = (
  id: string,
  cb: (record: Doc | null) => void,
  onError?: ErrorCallback,
) => watchDoc('auctions', id, cb, onError);

export const watchReports = (cb: RecordCallback, onError?: ErrorCallback) =>
  watch('moderationReports', cb, onError);

export const watchAuctions = (cb: RecordCallback, onError?: ErrorCallback) =>
  watch('auctions', cb, onError);

export const watchItems = (cb: RecordCallback, onError?: ErrorCallback) => watch('items', cb, onError);

export const watchRewardRules = (cb: RecordCallback, onError?: ErrorCallback) =>
  watch('rewardRules', cb, onError);

export const watchBadges = (cb: RecordCallback, onError?: ErrorCallback) => watch('badges', cb, onError);

export const watchGrants = (cb: RecordCallback, onError?: ErrorCallback) =>
  watch('rewardGrants', cb, onError);

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function reviewVerification(
  id: string,
  status: 'approved' | 'rejected',
  reviewerId: string,
  notes?: string,
): Promise<void> {
  if (!db) return;
  await updateDoc(
    doc(db, 'verifications', id),
    clean({ status, reviewed_at: Date.now(), reviewed_by: reviewerId, notes }),
  );
}

export async function updateUserModeration(
  uid: string,
  patch: Pick<Profile, 'moderation_status' | 'suspended_until' | 'admin_notes' | 'trust_score'>,
): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'users', uid), clean(patch));
}

/**
 * Creates or updates an auction.
 *
 * Pass an explicit id when editing; when omitted, Firestore's own id generator
 * is used so the caller never needs to invent one during render.
 */
export async function saveAuction(
  auction: Omit<AuctionRecord, 'id'> & { id?: string },
): Promise<void> {
  if (!db) return;
  const { id: providedId, ...data } = auction;
  const target = providedId ?? doc(collection(db, 'auctions')).id;
  await setDoc(doc(db, 'auctions', target), clean(data), { merge: true });
}

export async function saveRewardRule(rule: RewardRule): Promise<void> {
  if (!db) return;
  const { id, ...data } = rule;
  await setDoc(doc(db, 'rewardRules', id), clean(data), { merge: true });
}

export async function saveBadge(badge: RewardBadge): Promise<void> {
  if (!db) return;
  const { id, ...data } = badge;
  await setDoc(doc(db, 'badges', id), clean(data), { merge: true });
}

export async function grantReward(grant: Omit<RewardGrant, 'id'> & { id?: string }): Promise<void> {
  if (!db) return;
  const { id: providedId, ...data } = grant;
  const autoId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await setDoc(doc(db, 'rewardGrants', providedId ?? autoId), clean(data));
}

export async function resolveReport(id: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'moderationReports', id), { status: 'resolved' });
}

export async function deleteAuction(id: string): Promise<void> {
  if (!db) return;
  await deleteDoc(doc(db, 'auctions', id));
}

/**
 * Approves/rejects a verification request and mirrors the outcome onto the
 * trader's profile.
 *
 * The profile update is best-effort: demo rows and imported requests have no
 * user document, and a missing profile must not roll back the review.
 */
export async function decideVerification(
  request: VerificationRequest,
  status: 'approved' | 'rejected',
  reviewerId: string,
  notes?: string,
): Promise<void> {
  await reviewVerification(request.id, status, reviewerId, notes);
  if (!db || !request.user_id) return;
  try {
    await updateDoc(doc(db, 'users', request.user_id), { is_verified: status === 'approved' });
  } catch {
    // No profile document (demo data) or the field was already correct.
  }
}

export async function saveVerificationNotes(id: string, notes: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'verifications', id), { notes });
}

export async function saveProfileDoc(profile: Profile): Promise<void> {
  if (!db) return;
  const { id, ...data } = profile;
  await setDoc(doc(db, 'users', id), clean(data), { merge: true });
}

export async function saveItem(item: Item): Promise<void> {
  if (!db) return;
  const { id, ...data } = item;
  await setDoc(doc(db, 'items', id), clean(data), { merge: true });
}

export async function saveVerificationRequest(request: VerificationRequest): Promise<void> {
  if (!db) return;
  const { id, ...data } = request;
  await setDoc(doc(db, 'verifications', id), clean(data), { merge: true });
}

export async function saveModerationReport(report: ModerationReport): Promise<void> {
  if (!db) return;
  const { id, ...data } = report;
  await setDoc(doc(db, 'moderationReports', id), clean(data), { merge: true });
}

export type { Unsubscribe };
/**
 * Admin-only Cloud Functions for Puran Haat.
 *
 * The Firestore rules already stop a suspended or banned trader from posting,
 * chatting or trading, because every write reads the moderation fields back off
 * their profile document. The rules cannot, however, stop someone from signing
 * in and reading the app, and they cannot touch Firebase Auth at all: only the
 * Admin SDK can disable or delete an account.
 *
 * These two callables are that missing layer. Both check the caller against the
 * `admins/{uid}` allow-list (the same document the portal's Firestore rules
 * trust) before doing anything, and the Admin SDK is never exposed to the
 * client.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';

initializeApp();

const auth = getAuth();
const db = getFirestore();

/**
 * Confirms the caller is a signed-in administrator.
 *
 * `admins/{uid}` is the portal's existing allow-list: a document that exists
 * means the account may moderate. Checking it here (rather than trusting a
 * custom claim) keeps the portal and the functions in agreement, and means
 * revoking an admin is a single document delete.
 */
async function assertAdmin(request: CallableRequest<unknown>): Promise<string> {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Sign in to the admin portal first.');
  }
  const snapshot = await db.doc(`admins/${uid}`).get();
  if (!snapshot.exists) {
    throw new HttpsError('permission-denied', 'This account is not an administrator.');
  }
  return uid;
}

function requireTargetUid(data: unknown): string {
  const uid = (data as { uid?: unknown } | null)?.uid;
  if (typeof uid !== 'string' || uid.length === 0) {
    throw new HttpsError('invalid-argument', 'A target user id is required.');
  }
  return uid;
}

/**
 * Disables (or re-enables) a Firebase Auth account.
 *
 * A disabled account cannot sign in and its refresh tokens are revoked, so an
 * app that is already open is signed out on the next token refresh. The
 * moderation fields are mirrored onto the profile document so the portal can
 * show the state without querying Auth, but the profile mirror is best-effort:
 * the account is already locked either way.
 */
export const setAccountDisabled = onCall(async (request) => {
  const adminUid = await assertAdmin(request);
  const uid = requireTargetUid(request.data);
  const disabled = (request.data as { disabled?: unknown }).disabled === true;

  if (uid === adminUid) {
    throw new HttpsError('failed-precondition', 'You cannot disable your own administrator account.');
  }

  try {
    await auth.updateUser(uid, { disabled });
    if (disabled) {
      // Kill live sessions so the block takes effect without waiting for the
      // ID token to expire.
      await auth.revokeRefreshTokens(uid);
    }
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'auth/user-not-found') {
      throw new HttpsError('not-found', 'That account no longer exists.');
    }
    throw new HttpsError('internal', (error as Error).message);
  }

  try {
    await db.doc(`users/${uid}`).set(
      {
        account_disabled: disabled,
        account_disabled_at: disabled ? Date.now() : 0,
        account_disabled_by: disabled ? adminUid : '',
      },
      { merge: true },
    );
  } catch {
    // A profile document is not guaranteed to exist (for example for a guest
    // that never completed onboarding). The Auth account is what matters.
  }

  return { uid, disabled };
});

/**
 * Permanently deletes a Firebase Auth account and its profile document.
 *
 * Listings, proposals and reviews are kept as historical records: deleting them
 * would rewrite other traders' trade history. Their author snapshot keeps the
 * display name so the UI can still render "deleted account" style rows.
 */
export const deleteAccount = onCall(async (request) => {
  const adminUid = await assertAdmin(request);
  const uid = requireTargetUid(request.data);

  if (uid === adminUid) {
    throw new HttpsError('failed-precondition', 'You cannot delete your own administrator account.');
  }

  try {
    await auth.deleteUser(uid);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'auth/user-not-found') {
      throw new HttpsError('not-found', 'That account no longer exists.');
    }
    throw new HttpsError('internal', (error as Error).message);
  }

  try {
    await db.doc(`users/${uid}`).delete();
  } catch {
    // Nothing to remove, or the document was already gone.
  }

  return { uid, deleted: true };
});

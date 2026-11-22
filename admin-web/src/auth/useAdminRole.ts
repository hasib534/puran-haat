import { useEffect, useState } from 'react';

import { watchAdmins } from '../lib/admin';
import { isConfigured } from '../lib/firebase';
import { toAdminMember, type AdminMember } from '../lib/models';
import { useAuth } from './AuthProvider';

interface AdminRole {
  loading: boolean;
  isAdmin: boolean;
  /** UID the current answer belongs to — prevents a stale grant after sign-out. */
  member: AdminMember | null;
}

/**
 * Resolves membership from the `admins/{uid}` roster document.
 *
 * Firestore rules enforce access; this hook only decides what the UI offers.
 * See docs/admin-portal.md in the Expo project for the bootstrap step.
 */
export function useAdminRole(): AdminRole {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [state, setState] = useState<{ uid: string; member: AdminMember | null } | null>(null);

  useEffect(() => {
    if (!isConfigured || !uid) return;
    return watchAdmins(
      uid,
      (record) => setState({ uid, member: record ? toAdminMember(record) : null }),
      () => setState({ uid, member: null }),
    );
  }, [uid]);

  const current = state && state.uid === uid ? state : null;

  return {
    loading: Boolean(uid) && !current,
    isAdmin: Boolean(uid && current?.member),
    member: current?.member ?? null,
  };
}
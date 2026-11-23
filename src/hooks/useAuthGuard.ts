import { useCallback } from 'react';
import { router } from 'expo-router';

import { useAuth } from '../context/AuthContext';
import { showAlert } from '../lib/alert';

interface GuardOptions {
  requireVerified?: boolean;
}

export function useAuthGuard() {
  const { user, configured, resendVerification } = useAuth();

  const guard = useCallback(
    (action: string, options: GuardOptions = {}) => {
      if (!configured) return true;

      if (!user) {
        showAlert('Sign in required', `Sign in to ${action}.`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/auth' as never) },
        ]);
        return false;
      }

      if (options.requireVerified && !user.emailVerified) {
        // Guests use Anonymous Auth and have no inbox to verify, so invite them
        // to create a real account instead.
        if (user.isAnonymous) {
          showAlert('Create an account', `Guests can browse and chat. Create a free account to ${action}.`, [
            { text: 'Not now', style: 'cancel' },
            { text: 'Create account', onPress: () => router.push('/auth' as never) },
          ]);
          return false;
        }
        showAlert(
          'Verify your email',
          `Please verify ${user.email} before you ${action}.`,
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Resend email',
              onPress: () => {
                resendVerification().catch((error: Error) =>
                  showAlert('Could not send email', error.message),
                );
              },
            },
          ],
        );
        return false;
      }

      return true;
    },
    [configured, resendVerification, user],
  );

  return {
    guard,
    canAct: !configured || Boolean(user),
    isVerified: !configured || Boolean(user?.emailVerified),
    /** True while browsing as a guest (or when Firebase is unset). */
    isGuest: !configured || !user || user.isAnonymous,
  };
}

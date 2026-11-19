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
  };
}

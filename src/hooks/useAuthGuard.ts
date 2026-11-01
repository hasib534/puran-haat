import { useCallback } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '../context/AuthContext';

interface GuardOptions {
  requireVerified?: boolean;
}

export function useAuthGuard() {
  const { user, configured, resendVerification } = useAuth();

  const guard = useCallback(
    (action: string, options: GuardOptions = {}) => {
      if (!configured) return true;

      if (!user) {
        Alert.alert('Sign in required', `Sign in to ${action}.`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/auth' as never) },
        ]);
        return false;
      }

      if (options.requireVerified && !user.emailVerified) {
        Alert.alert(
          'Verify your email',
          `Please verify ${user.email} before you ${action}.`,
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Resend email',
              onPress: () => {
                resendVerification().catch((error: Error) =>
                  Alert.alert('Could not send email', error.message),
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

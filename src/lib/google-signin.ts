import { Platform } from 'react-native';

/**
 * Google Sign-In on iOS/Android.
 *
 * Expo's browser-based Google provider (expo-auth-session) cannot complete the
 * native OAuth redirect with iOS/Android client IDs. The official native
 * library is required instead. It is loaded lazily so the web bundle never
 * touches the native module.
 */

const DEVELOPMENT_BUILD_MESSAGE =
  'Google sign-in on phones requires a development build. Run `npx expo run:android` / `npx expo run:ios`, or install an EAS development build.';

let configuredWebClientId: string | null = null;

export class GoogleSignInUnavailableError extends Error {}

export async function signInWithGoogleNative(
  webClientId: string | undefined,
): Promise<string | null> {
  if (Platform.OS === 'web') {
    throw new Error('Native Google sign-in is not available on web.');
  }
  if (!webClientId) {
    throw new Error(
      'Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID. Add the Web OAuth client ID to .env.local.',
    );
  }

  let module: typeof import('@react-native-google-signin/google-signin');
  try {
    module = await import('@react-native-google-signin/google-signin');
  } catch {
    throw new GoogleSignInUnavailableError(DEVELOPMENT_BUILD_MESSAGE);
  }

  const {
    GoogleSignin,
    isErrorWithCode,
    isSuccessResponse,
    statusCodes,
  } = module;

  try {
    if (configuredWebClientId !== webClientId) {
      GoogleSignin.configure({ webClientId, offlineAccess: false });
      configuredWebClientId = webClientId;
    }
  } catch {
    // The JS package is present in Expo Go, but its native module is not.
    throw new GoogleSignInUnavailableError(DEVELOPMENT_BUILD_MESSAGE);
  }

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();

    if (response.type === 'cancelled') return null;

    if (!isSuccessResponse(response)) {
      throw new Error('Google sign-in did not return an account.');
    }

    const idToken = response.data.idToken;
    if (!idToken) {
      throw new Error(
        'Google did not return an ID token. Check that the Web client ID matches the Firebase project.',
      );
    }
    return idToken;
  } catch (error) {
    if (isErrorWithCode(error)) {
      const code = String(error.code);
      if (code === statusCodes.SIGN_IN_CANCELLED) return null;
      if (code === statusCodes.IN_PROGRESS) {
        throw new Error('Google sign-in is already in progress.');
      }
      if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Google Play Services is unavailable or needs an update.');
      }
      if (code === statusCodes.NULL_PRESENTER) {
        throw new GoogleSignInUnavailableError(DEVELOPMENT_BUILD_MESSAGE);
      }
      // Android status code 10. The native library rejects with the raw string
      // "DEVELOPER_ERROR: Follow troubleshooting instructions at ...", which is
      // useless to a trader. In practice it means the signing certificate (or
      // package name) baked into this build is not registered in the Google
      // Cloud / Firebase project, so Google refuses to hand back an ID token.
      if (code === '10') {
        throw new Error(
          'Google sign-in rejected this build (DEVELOPER_ERROR). The app\u2019s signing SHA-1 ' +
            'fingerprint is not registered for package com.puranhaat.app in the Firebase ' +
            'project. Add it under Project settings \u2192 Your apps, then reinstall.',
        );
      }
      if (code === '12500') {
        throw new Error('Google sign-in failed. Please try again.');
      }
    }
    throw error;
  }
}

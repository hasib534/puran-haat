import { Stack, router, useRootNavigationState, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useSyncExternalStore } from "react";
import { LogBox, StyleSheet, View } from "react-native";
import { Colors } from "../constants/colors";
import { AppProvider } from "../context/AppContext";
import { AuthProvider } from "../context/AuthContext";
import { LocationProvider } from "../context/LocationContext";
import {
  getOnboardingSeen,
  loadOnboardingSeen,
  subscribeOnboarding,
} from "../lib/onboarding";
import { configurePushNotifications, observeNotificationTaps } from "../lib/push";

// Dev-only: the Firestore SDK emits a benign "WebChannelConnection ... transport
// errored" warning whenever its long-poll listener reconnects. This is routine on
// emulators and flaky networks and the SDK retries on its own, so keep it out of
// the LogBox toast without hiding genuine Firestore errors.
if (__DEV__) {
  LogBox.ignoreLogs([/WebChannelConnection[\s\S]*transport errored/]);
}

export default function RootLayout() {
  // null = still reading storage, true/false = known.
  const onboardingSeen = useSyncExternalStore(
    subscribeOnboarding,
    getOnboardingSeen,
    getOnboardingSeen,
  );
  const navigationState = useRootNavigationState();
  const segments = useSegments();

  useEffect(() => {
    loadOnboardingSeen();
  }, []);

  // Show notifications while the app is open, and open the right chat when a
  // trader taps one. Both are no-ops on web or when no push sender is set up.
  useEffect(() => {
    void configurePushNotifications();
    let cancelled = false;
    let dispose: (() => void) | undefined;
    observeNotificationTaps((url) => {
      router.push(url as never);
    }).then((cleanup) => {
      if (cancelled) cleanup();
      else dispose = cleanup;
    });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);

  const onOnboardingRoute = segments[0] === "onboarding";

  useEffect(() => {
    // Wait until the navigator is mounted before redirecting.
    if (!navigationState?.key) return;
    if (onboardingSeen === false && !onOnboardingRoute) {
      router.replace("/onboarding");
    }
  }, [navigationState?.key, onboardingSeen, onOnboardingRoute]);

  // Cover the first frame so the Home feed never flashes before we redirect.
  const showBootCover = onboardingSeen === null || (onboardingSeen === false && !onOnboardingRoute);

  return (
    <AuthProvider>
      <LocationProvider>
        <AppProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: Colors.background },
              animation: "slide_from_right",
            }}
          >
            <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
            <Stack.Screen
              name="location"
              options={{ presentation: "modal", animation: "slide_from_bottom" }}
            />
          </Stack>
          {showBootCover && <View style={styles.bootCover} />}
        </AppProvider>
      </LocationProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  bootCover: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: Colors.background,
  },
});
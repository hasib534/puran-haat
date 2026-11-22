import { Stack, router, useRootNavigationState, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useSyncExternalStore } from "react";
import { StyleSheet, View } from "react-native";
import { Colors } from "../constants/colors";
import { AppProvider } from "../context/AppContext";
import { AuthProvider } from "../context/AuthContext";
import {
  getOnboardingSeen,
  loadOnboardingSeen,
  subscribeOnboarding,
} from "../lib/onboarding";

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
        </Stack>
        {showBootCover && <View style={styles.bootCover} />}
      </AppProvider>
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
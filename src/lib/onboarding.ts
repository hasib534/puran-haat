import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'puran-haat:onboarding-complete';

/**
 * Onboarding is shown once, on the very first launch. The gate lives in the
 * root layout, but the "finish" action lives on the onboarding screen, so the
 * state is kept in a tiny module-level store that both read from. Setting it
 * synchronously (before the async write resolves) avoids the root layout
 * bouncing the user back to the intro after they tap "Get Started".
 */
let seen: boolean | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeOnboarding(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Snapshot for useSyncExternalStore: null while unknown, then a boolean. */
export function getOnboardingSeen(): boolean | null {
  return seen;
}

/**
 * Reads the persisted flag once. Storage failures resolve to `true` so a broken
 * store never traps the user in the intro loop.
 */
export async function loadOnboardingSeen(): Promise<boolean> {
  if (seen !== null) return seen;
  try {
    seen = (await AsyncStorage.getItem(KEY)) === 'true';
  } catch {
    seen = true;
  }
  emit();
  return seen;
}

export async function markOnboardingSeen(): Promise<void> {
  if (seen !== true) {
    seen = true;
    emit();
  }
  try {
    await AsyncStorage.setItem(KEY, 'true');
  } catch {
    // Non-fatal: worst case the intro appears again next launch.
  }
}
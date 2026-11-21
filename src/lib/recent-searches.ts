import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'puran-haat:recent-searches';
const MAX_TERMS = 6;

function storageKey(uid?: string): string {
  return `${KEY_PREFIX}:${uid || 'guest'}`;
}

export async function loadRecentSearches(uid?: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((term): term is string => typeof term === 'string').slice(0, MAX_TERMS);
  } catch {
    return [];
  }
}

export async function saveRecentSearches(uid: string | undefined, terms: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      storageKey(uid),
      JSON.stringify(terms.slice(0, MAX_TERMS)),
    );
  } catch {
    // Recent searches are a convenience; storage failures are non-fatal.
  }
}

/** Adds a term to the front of the list, de-duplicated case-insensitively. */
export function mergeRecentSearch(terms: string[], term: string): string[] {
  const trimmed = term.trim();
  if (trimmed.length < 2) return terms;
  return [
    trimmed,
    ...terms.filter((existing) => existing.toLowerCase() !== trimmed.toLowerCase()),
  ].slice(0, MAX_TERMS);
}

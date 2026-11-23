/**
 * Pure helpers for the live-chat signals (typing, presence, read receipts).
 * Kept free of React and Firestore so both the chat screen and the inbox can
 * share the exact same freshness rules.
 */

/** A typing heartbeat older than this is treated as "stopped typing". */
export const TYPING_TTL_MS = 5_000;

export interface PresenceEntry {
  online: boolean;
  lastSeen: number;
}

/** True while a typing heartbeat is still considered live. */
export function isTypingFresh(typingAt: number | undefined, now: number): boolean {
  return typeof typingAt === 'number' && typingAt > 0 && now - typingAt < TYPING_TTL_MS;
}

/**
 * True when `readWatermark` shows the other participant has read a message
 * created at `messageCreatedAt`. Messages sent after their last read stay
 * unread, which is exactly the "Seen" boundary we want.
 */
export function isSeenByPeer(readWatermark: number | undefined, messageCreatedAt?: number): boolean {
  if (!readWatermark || !messageCreatedAt) return false;
  return readWatermark >= messageCreatedAt;
}

/**
 * A human label for the chat header subtitle: live typing wins over presence,
 * which wins over the last-seen timestamp.
 */
export function presenceLabel(
  presence: PresenceEntry | undefined,
  typingAt: number | undefined,
  now: number,
): string | null {
  if (isTypingFresh(typingAt, now)) return 'typing…';
  if (!presence) return null;
  if (presence.online) return 'Online';
  return formatLastSeen(presence.lastSeen, now);
}

/** Relative "last seen" text, e.g. "Last seen 5m ago". */
export function formatLastSeen(lastSeen: number | undefined, now: number): string {
  if (!lastSeen) return 'Offline';
  const diff = now - lastSeen;
  if (diff < 60_000) return 'Last seen just now';
  if (diff < 3_600_000) return `Last seen ${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `Last seen ${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `Last seen ${Math.floor(diff / 86_400_000)}d ago`;
  return `Last seen ${new Date(lastSeen).toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
}

import { useEffect, useRef } from 'react';

/** Re-publish at most this often while someone keeps typing. */
const HEARTBEAT_INTERVAL_MS = 2_500;
/** Declare "stopped typing" after this much silence. */
const STOP_AFTER_MS = 3_000;

/**
 * Publishes and clears the caller's live "typing" heartbeat for a thread.
 *
 * The state lives in a ref so keystrokes never re-render the screen, and the
 * heartbeat is guaranteed to be cleared when the conversation changes or the
 * screen unmounts. `publish` is read through a ref so a new callback identity
 * never restarts the signal.
 */
export function useTypingSignal(
  conversationId: string | undefined,
  publish: (conversationId: string, isTyping: boolean) => void,
) {
  const state = useRef({ lastHeartbeat: 0, stopTimer: null as ReturnType<typeof setTimeout> | null });
  const publishRef = useRef(publish);
  useEffect(() => {
    publishRef.current = publish;
  });

  // Never leave a stale "typing…" behind when the thread changes or we leave.
  useEffect(() => {
    const current = state.current;
    return () => {
      if (current.stopTimer) {
        clearTimeout(current.stopTimer);
        current.stopTimer = null;
      }
      if (current.lastHeartbeat && conversationId) {
        current.lastHeartbeat = 0;
        publishRef.current(conversationId, false);
      }
    };
  }, [conversationId]);

  const stop = () => {
    const current = state.current;
    if (current.stopTimer) {
      clearTimeout(current.stopTimer);
      current.stopTimer = null;
    }
    if (current.lastHeartbeat && conversationId) {
      current.lastHeartbeat = 0;
      publishRef.current(conversationId, false);
    }
  };

  const onChange = (text: string) => {
    if (!conversationId) return;
    if (text.trim().length === 0) {
      stop();
      return;
    }
    const current = state.current;
    const stamp = Date.now();
    if (stamp - current.lastHeartbeat > HEARTBEAT_INTERVAL_MS) {
      current.lastHeartbeat = stamp;
      publishRef.current(conversationId, true);
    }
    if (current.stopTimer) clearTimeout(current.stopTimer);
    current.stopTimer = setTimeout(() => {
      current.stopTimer = null;
      if (current.lastHeartbeat) {
        current.lastHeartbeat = 0;
        publishRef.current(conversationId, false);
      }
    }, STOP_AFTER_MS);
  };

  return { onChange, stop };
}

import { useEffect, useState } from 'react';

/**
 * A coarse wall-clock tick so screens can expire "typing…" indicators and
 * refresh relative "last seen" labels. One timer per caller; keep it off
 * screens that do not need it.
 */
export function useNow(intervalMs = 5000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}

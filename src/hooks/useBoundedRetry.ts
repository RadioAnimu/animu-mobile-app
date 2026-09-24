import { useCallback, useEffect, useState } from "react";

/** Delay between automatic image-load retries (shared with `Cover`). */
export const RETRY_DELAY_MS = 3000;
const MAX_RETRIES = 2;

/**
 * Bounded, self-healing retry for image loads. The retry counter resets
 * during render when `key` changes, so a new URL/revision never inherits a
 * stale failed frame; `fail` ignores a late error whose captured key is no
 * longer current. After `maxRetries` automatic retries the failure sticks
 * until the key changes.
 */
export function useBoundedRetry(
  key: string | number,
  maxRetries: number = MAX_RETRIES,
  delayMs: number = RETRY_DELAY_MS,
) {
  const [state, setState] = useState({ key, failed: false, retry: 0 });

  if (state.key !== key) {
    setState({ key, failed: false, retry: 0 });
  }

  const fail = useCallback(() => {
    setState((prev) => (prev.key === key ? { ...prev, failed: true } : prev));
  }, [key]);

  useEffect(() => {
    if (!state.failed || state.retry >= maxRetries) return;
    const timer = setTimeout(() => {
      setState((prev) => ({ ...prev, failed: false, retry: prev.retry + 1 }));
    }, delayMs);
    return () => clearTimeout(timer);
  }, [state.failed, state.retry, maxRetries, delayMs]);

  return { failed: state.failed, retry: state.retry, fail };
}

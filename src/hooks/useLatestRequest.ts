import { useCallback, useRef } from "react";

/**
 * Monotonic request token. Call `begin()` before starting an async request and
 * `isCurrent(id)` after it resolves; only the newest request may write results,
 * so an out-of-order response (e.g. a slow first page landing after a fast
 * second) can never clobber newer state.
 */
export function useLatestRequest() {
  const currentRef = useRef(0);

  const begin = useCallback(() => {
    currentRef.current += 1;
    return currentRef.current;
  }, []);

  const isCurrent = useCallback((id: number) => id === currentRef.current, []);

  return { begin, isCurrent };
}

import { useEffect, useRef } from "react";

import { onReselect } from "@/core/navigation/reselect";

/**
 * Runs `handler` when the user re-taps this screen's drawer item — the
 * familiar "tap the active item again to jump to the top" gesture.
 *
 * The handler lives in a ref so passing a fresh closure each render does not
 * re-subscribe; only a route change does.
 */
export function useRouteReselect(routeName: string, handler: () => void): void {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(
    () => onReselect(routeName, () => handlerRef.current()),
    [routeName],
  );
}

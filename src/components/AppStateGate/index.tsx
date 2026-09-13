import React, { type ReactNode } from "react";
import { Freeze } from "react-freeze";
import { useIsBackgrounded } from "../../contexts/app-state/AppStateProvider";

/**
 * Suspends rendering of the UI subtree while the app is backgrounded.
 *
 * `react-freeze` uses React Suspense to stop re-renders of the wrapped tree
 * without unmounting it — React state, scroll positions and native views are
 * retained. This is the safety net on top of the player-side gating: even if
 * something else triggers a state change while hidden, no reconciliation
 * happens. Only the providers (playback, auth, settings) stay live.
 */
export function AppStateGate({ children }: { children: ReactNode }) {
  const isBackgrounded = useIsBackgrounded();
  return <Freeze freeze={isBackgrounded}>{children}</Freeze>;
}

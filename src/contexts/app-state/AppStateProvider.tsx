import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AppState, type AppStateStatus } from "react-native";

/**
 * App-wide "is the app in the background" signal.
 *
 * Exists so UI work can be paused explicitly: React Native keeps the JS
 * runtime and native animations alive in the background (Android keeps the
 * process via our playback foreground service; iOS keeps it via the audio
 * session), so nothing stops rendering on its own. Consumers use this to
 * stop timers, animations and store emissions while hidden.
 *
 * Only `background` counts — iOS briefly reports `inactive` for transient
 * events (Control Center, notification shade) where the UI is still visible.
 */
const AppBackgroundContext = createContext(false);

const KNOWN_STATUSES: ReadonlySet<string> = new Set<AppStateStatus>(["active", "background", "inactive", "extension"]);

/** RN types the launch state as any string, or none yet. */
function isKnownStatus(state: string | null | undefined): state is AppStateStatus {
  return state != null && KNOWN_STATUSES.has(state);
}
const AppStatusContext = createContext<AppStateStatus>("active");

export const AppStateProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // Before RN reports a state (or while it is "unknown"), the app is in front.
  const [state, setState] = useState<AppStateStatus>(() =>
    isKnownStatus(AppState.currentState) ? AppState.currentState : "active",
  );

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        setState(nextState);
      },
    );
    return () => subscription.remove();
  }, []);

  const isBackgrounded = state === "background";

  return (
    <AppStatusContext.Provider value={state}>
      <AppBackgroundContext.Provider value={isBackgrounded}>
        {children}
      </AppBackgroundContext.Provider>
    </AppStatusContext.Provider>
  );
};

export const useIsBackgrounded = (): boolean =>
  useContext(AppBackgroundContext);

/** The raw AppState value ("active" / "inactive" / "background"). */
export const useAppStateStatus = (): AppStateStatus =>
  useContext(AppStatusContext);

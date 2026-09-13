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

export const AppStateProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [isBackgrounded, setIsBackgrounded] = useState(
    () => AppState.currentState === "background",
  );

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        setIsBackgrounded(nextState === "background");
      },
    );
    return () => subscription.remove();
  }, []);

  return (
    <AppBackgroundContext.Provider value={isBackgrounded}>
      {children}
    </AppBackgroundContext.Provider>
  );
};

export const useIsBackgrounded = (): boolean =>
  useContext(AppBackgroundContext);

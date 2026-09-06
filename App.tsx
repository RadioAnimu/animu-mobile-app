import { Background } from "./src/components/Background";
import ErrorBoundary from "./src/components/ErrorBoundary";

import { Routes } from "./src/routes";
import { PlayerProvider } from "./src/contexts/player/PlayerProvider";
import { LyricsProvider } from "./src/contexts/lyrics/LyricsProvider";
import { UserSettingsProvider } from "./src/contexts/user/UserSettingsProvider";
import { AlertProvider } from "./src/contexts/alert/AlertProvider";
import { AuthProvider } from "./src/contexts/auth/AuthProvider";
import { PortalProvider } from "./src/contexts/Portal";
import { MyStatusBar } from "./src/components/MyStatusBar";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <MyStatusBar />
        <Background>
          <PortalProvider>
            <AlertProvider>
              <PlayerProvider>
                <LyricsProvider>
                  <UserSettingsProvider>
                    <AuthProvider>
                      <Routes />
                    </AuthProvider>
                  </UserSettingsProvider>
                </LyricsProvider>
              </PlayerProvider>
            </AlertProvider>
          </PortalProvider>
        </Background>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

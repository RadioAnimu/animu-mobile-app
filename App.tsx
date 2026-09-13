import { Background } from "./src/components/Background";
import ErrorBoundary from "./src/components/ErrorBoundary";
import { AppStateGate } from "./src/components/AppStateGate";

import { Routes } from "./src/routes";
import { AppStateProvider } from "./src/contexts/app-state/AppStateProvider";
import { PlayerProvider } from "./src/contexts/player/PlayerProvider";
import { UserSettingsProvider } from "./src/contexts/user/UserSettingsProvider";
import { AlertProvider } from "./src/contexts/alert/AlertProvider";
import { AuthProvider } from "./src/contexts/auth/AuthProvider";
import { PortalProvider } from "./src/contexts/Portal";
import { MyStatusBar } from "./src/components/MyStatusBar";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function App() {
  return (
    <ErrorBoundary>
      <AppStateProvider>
        <SafeAreaProvider>
          <MyStatusBar />
          <Background>
            <PortalProvider>
              <AlertProvider>
                <PlayerProvider>
                  <UserSettingsProvider>
                    <AuthProvider>
                      <AppStateGate>
                        <Routes />
                      </AppStateGate>
                    </AuthProvider>
                  </UserSettingsProvider>
                </PlayerProvider>
              </AlertProvider>
            </PortalProvider>
          </Background>
        </SafeAreaProvider>
      </AppStateProvider>
    </ErrorBoundary>
  );
}

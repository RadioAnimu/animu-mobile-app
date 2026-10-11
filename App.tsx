import { Background } from "@/components/Background";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AppStateGate } from "@/components/AppStateGate";

import { Routes } from "@/routes";
import { AppStateProvider } from "@/contexts/app-state/AppStateProvider";
import { PlayerProvider } from "@/contexts/player/PlayerProvider";
import { UserSettingsProvider } from "@/contexts/user/UserSettingsProvider";
import { AlertProvider } from "@/contexts/alert/AlertProvider";
import { AuthProvider } from "@/contexts/auth/AuthProvider";
import { PortalProvider } from "@/contexts/Portal";
import { MyStatusBar } from "@/components/MyStatusBar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";

export default function App() {
  return (
    <ErrorBoundary>
      <AppStateProvider>
        <SafeAreaProvider>
          {/* Frame-synced keyboard tracking for every form. The app is
              edge-to-edge (Android draws under both system bars), so the
              reported keyboard height includes the navigation bar — the same
              quantity iOS reports — and each surface subtracts the bottom
              safe area exactly once. */}
          <KeyboardProvider
            statusBarTranslucent
            navigationBarTranslucent
            preserveEdgeToEdge
          >
            <MyStatusBar />
            <Background>
              <PortalProvider>
                <UserSettingsProvider>
                  <AlertProvider>
                    <PlayerProvider>
                      <AuthProvider>
                        <AppStateGate>
                          <Routes />
                        </AppStateGate>
                      </AuthProvider>
                    </PlayerProvider>
                  </AlertProvider>
                </UserSettingsProvider>
              </PortalProvider>
            </Background>
          </KeyboardProvider>
        </SafeAreaProvider>
      </AppStateProvider>
    </ErrorBoundary>
  );
}

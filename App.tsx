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
import { OtaProvider } from "@/contexts/ota/OtaProvider";
import { MyStatusBar } from "@/components/MyStatusBar";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function App() {
  return (
    <ErrorBoundary>
      <AppStateProvider>
        <SafeAreaProvider>
          <MyStatusBar />
          <Background>
            <PortalProvider>
              <UserSettingsProvider>
                <AlertProvider>
                  <PlayerProvider>
                    <AuthProvider>
                      <OtaProvider>
                        <AppStateGate>
                          <Routes />
                        </AppStateGate>
                      </OtaProvider>
                    </AuthProvider>
                  </PlayerProvider>
                </AlertProvider>
              </UserSettingsProvider>
            </PortalProvider>
          </Background>
        </SafeAreaProvider>
      </AppStateProvider>
    </ErrorBoundary>
  );
}

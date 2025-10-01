import { Background } from "./src/components/Background";

import { Routes } from "./src/routes";
import { THEME } from "./src/theme";
import { PlayerProvider } from "./src/contexts/player/PlayerProvider";
import { UserSettingsProvider } from "./src/contexts/user/UserSettingsProvider";
import { AlertProvider } from "./src/contexts/alert/AlertProvider";
import { AuthProvider } from "./src/contexts/auth/AuthProvider";
import { PortalProvider } from "./src/contexts/Portal";
import { MyStatusBar } from "./src/components/MyStatusBar";

export default function App() {
  return (
    <>
      <MyStatusBar backgroundColor={THEME.COLORS.PRIMARY} />
      <Background>
        <PortalProvider>
          <AlertProvider>
            <PlayerProvider>
              <UserSettingsProvider>
                <AuthProvider>
                  <Routes />
                </AuthProvider>
              </UserSettingsProvider>
            </PlayerProvider>
          </AlertProvider>
        </PortalProvider>
      </Background>
    </>
  );
}

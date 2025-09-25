import { Background } from "./src/components/Background";

import { useFonts } from "expo-font";

import { Routes } from "./src/routes";
import { Loading } from "./src/screens/Loading";
import { THEME } from "./src/theme";
import { PlayerProvider } from "./src/contexts/player/PlayerProvider";
import { UserSettingsProvider } from "./src/contexts/user/UserSettingsProvider";
import { AlertProvider } from "./src/contexts/alert/AlertProvider";
import { AuthProvider } from "./src/contexts/auth/AuthProvider";
import { PortalProvider } from "./src/contexts/Portal";
import { MyStatusBar } from "./src/components/MyStatusBar";
import { useEffect } from "react";

export default function App() {
  const [fontsLoaded] = useFonts({
    "ProximaNova-Regular": require("./src/assets/fonts/proximanova-reg.ttf"),
    "ProximaNova-Light": require("./src/assets/fonts/proximanova-light.ttf"),
    "ProximaNova-Bold": require("./src/assets/fonts/proximanova-bold.ttf"),
    "ProximaNova-Black": require("./src/assets/fonts/ProximaNova-Black.ttf"),
  });

  useEffect(() => {
    console.log("App mounted");
    console.log(`Fonts loaded: ${fontsLoaded}`);
    return () => {
      console.log("App unmounted");
    };
  }, []);

  useEffect(() => {
    console.log(`Fonts loaded: ${fontsLoaded}`);
  }, [fontsLoaded]);

  return (
    <>
      <MyStatusBar backgroundColor={THEME.COLORS.PRIMARY} />
      {fontsLoaded ? (
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
      ) : (
        <Loading />
      )}
    </>
  );
}

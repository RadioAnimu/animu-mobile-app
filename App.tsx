import { Platform, StatusBar } from "react-native";
import { Background } from "./src/components/Background";

import { useFonts } from "expo-font";

import { useEffect, useMemo, useState } from "react";
import { DiscordUser, UserContext } from "./src/contexts/user.context";
import { Routes } from "./src/routes";
import { Loading } from "./src/screens/Loading";
import { THEME } from "./src/theme";
import { PlayerProvider } from "./src/contexts/player/PlayerProvider";
import { UserSettingsProvider } from "./src/contexts/user/UserSettingsProvider";
import { AlertProvider } from "./src/contexts/alert/AlertProvider";

export default function App() {
  const [isLoading, setIsLoading] = useState(true);

  const [user, setUser] = useState<DiscordUser | null>(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const userProvider = useMemo(() => ({ user, setUser }), [user, setUser]);

  const errorMessageProvider = useMemo(
    () => ({ errorMessage, setErrorMessage }),
    [errorMessage, setErrorMessage]
  );

  const successMessageProvider = useMemo(
    () => ({ successMessage, setSuccessMessage }),
    [successMessage, setSuccessMessage]
  );

  useEffect(() => {
    (async () => {
      console.log("App mounted");
      setIsLoading(false);
    })();
    return () => {
      console.log("App unmounted");
      try {
        // Sequence of events to destroy the player and turn off the app
        // player.destroy();
      } catch (err) {
        console.log(err);
      }
    };
  }, []);

  const [fontsLoaded] = useFonts({
    "ProximaNova-Regular": require("./src/assets/fonts/proximanova-reg.ttf"),
    "ProximaNova-Light": require("./src/assets/fonts/proximanova-light.ttf"),
    "ProximaNova-Bold": require("./src/assets/fonts/proximanova-bold.ttf"),
    "ProximaNova-Black": require("./src/assets/fonts/ProximaNova-Black.ttf"),
  });

  return (
    <>
      <StatusBar backgroundColor={THEME.COLORS.PRIMARY} />
      {fontsLoaded && !isLoading ? (
        <Background>
          <AlertProvider>
            <PlayerProvider>
              <UserContext.Provider value={userProvider}>
                <UserSettingsProvider>
                  <Routes />
                </UserSettingsProvider>
              </UserContext.Provider>
            </PlayerProvider>
          </AlertProvider>
        </Background>
      ) : (
        <Loading />
      )}
    </>
  );
}

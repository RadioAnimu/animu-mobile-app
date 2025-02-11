import { StatusBar } from "react-native";
import { Background } from "./src/components/Background";

import { useFonts } from "expo-font";

import { useEffect, useMemo, useState } from "react";
import { ErrorContext } from "./src/contexts/error.context";
import { SuccessContext } from "./src/contexts/success.context";
import { DiscordUser, UserContext } from "./src/contexts/user.context";
import { Routes } from "./src/routes";
import { Loading } from "./src/screens/Loading";
import { THEME } from "./src/theme";
import { PlayerProvider } from "./src/contexts/player/PlayerProvider";
import { UserSettingsProvider } from "./src/contexts/user/UserSettingsProvider";

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
      <StatusBar
        backgroundColor={THEME.COLORS.PRIMARY}
        barStyle="light-content"
        translucent
      />
      {fontsLoaded && !isLoading ? (
        <Background>
          <PlayerProvider>
            <UserContext.Provider value={userProvider}>
              <ErrorContext.Provider value={errorMessageProvider}>
                <SuccessContext.Provider value={successMessageProvider}>
                  <UserSettingsProvider>
                    <Routes />
                  </UserSettingsProvider>
                </SuccessContext.Provider>
              </ErrorContext.Provider>
            </UserContext.Provider>
          </PlayerProvider>
        </Background>
      ) : (
        <Loading />
      )}
    </>
  );
}

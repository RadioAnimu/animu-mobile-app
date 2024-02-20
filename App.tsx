import { StatusBar } from "react-native";
import { Background } from "./src/components/Background";

import { useFonts } from "expo-font";

import { useContext, useEffect, useMemo, useState } from "react";
import { AnimuInfoProps } from "./src/api";
import { AnimuInfoContext } from "./src/contexts/animuinfo.context";
import { ErrorContext } from "./src/contexts/error.context";
import {
  PlayerContext,
  PlayerProviderType,
} from "./src/contexts/player.context";
import { SuccessContext } from "./src/contexts/success.context";
import { DiscordUser, UserContext } from "./src/contexts/user.context";
import { Routes } from "./src/routes";
import { Loading } from "./src/screens/Loading";
import { THEME } from "./src/theme";
import { MyPlayerProps, myPlayer } from "./src/utils";

export default function App() {
  const [isLoading, setIsLoading] = useState(true);

  const [player, setPlayer] = useState<MyPlayerProps>(myPlayer());

  const [animuInfo, setAnimuInfo] = useState<AnimuInfoProps | null>(null);

  const [user, setUser] = useState<DiscordUser | null>(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const playerProvider: PlayerProviderType = useMemo(
    () => ({ player, setPlayer }),
    [player, setPlayer]
  );

  const animuInfoProvider = useMemo(
    () => ({ animuInfo, setAnimuInfo }),
    [animuInfo, setAnimuInfo]
  );

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
      await player.play();
      setPlayer(player);
      setIsLoading(false);
    })();
    return () => {
      console.log("App unmounted");
      try {
        // Sequence of events to destroy the player and turn off the app
        player.destroy();
      } catch (err) {
        console.log(err);
      }
    };
  }, []);

  const userContext = useContext(UserContext);

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
          <PlayerContext.Provider value={playerProvider}>
            <AnimuInfoContext.Provider value={animuInfoProvider}>
              <UserContext.Provider value={userProvider}>
                <ErrorContext.Provider value={errorMessageProvider}>
                  <SuccessContext.Provider value={successMessageProvider}>
                    <Routes />
                  </SuccessContext.Provider>
                </ErrorContext.Provider>
              </UserContext.Provider>
            </AnimuInfoContext.Provider>
          </PlayerContext.Provider>
        </Background>
      ) : (
        <Loading />
      )}
    </>
  );
}

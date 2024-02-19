import { StatusBar } from "react-native";
import { Background } from "./src/components/Background";

import { useFonts } from "expo-font";

import { useContext, useEffect, useMemo, useState } from "react";
import { AnimuInfoProps } from "./src/api";
import { AnimuInfoContext } from "./src/contexts/animuinfo.context";
import {
  PlayerContext,
  PlayerProviderType,
} from "./src/contexts/player.context";
import { DiscordUser, UserContext } from "./src/contexts/user.context";
import { Routes } from "./src/routes";
import { Loading } from "./src/screens/Loading";
import { THEME } from "./src/theme";
import { MyPlayerProps, myPlayer } from "./src/utils";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function App() {
  const [isLoading, setIsLoading] = useState(true);

  const [player, setPlayer] = useState<MyPlayerProps>(myPlayer());

  const [animuInfo, setAnimuInfo] = useState<AnimuInfoProps | null>(null);

  const [user, setUser] = useState<DiscordUser | null>(null);

  const playerProvider: PlayerProviderType = useMemo(
    () => ({ player, setPlayer }),
    [player, setPlayer]
  );

  const animuInfoProvider = useMemo(
    () => ({ animuInfo, setAnimuInfo }),
    [animuInfo, setAnimuInfo]
  );

  const userProvider = useMemo(() => ({ user, setUser }), [user, setUser]);

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

  const getUserSavedDataOrNull = async () => {
    try {
      const user = await AsyncStorage.getItem("user");
      return user ? JSON.parse(user) : null;
    } catch (e) {
      return null;
    }
  };

  useEffect(() => {
    if (userContext && !userContext.user) {
      getUserSavedDataOrNull()
        .then((user) => {
          if (user) {
            userContext.setUser(user);
          }
        })
        .catch((e) => {
          console.error(e);
        });
    }
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
          <PlayerContext.Provider value={playerProvider}>
            <AnimuInfoContext.Provider value={animuInfoProvider}>
              <UserContext.Provider value={userProvider}>
                <Routes />
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

import { StatusBar } from "react-native";
import { Background } from "./src/components/Background";

import { useFonts } from "expo-font";

import { Loading } from "./src/screens/Loading";
import { Routes } from "./src/routes";
import { useRef, useEffect, useState, useMemo, useContext } from "react";
import { MyPlayerProps, myPlayer } from "./src/utils";
import {
  PlayerContext,
  PlayerProviderType,
} from "./src/contexts/player.context";
import { AnimuInfoContext } from "./src/contexts/animuinfo.context";
import { THEME } from "./src/theme";
import { AnimuInfoProps } from "./src/api";

export default function App() {
  const [isLoading, setIsLoading] = useState(true);

  const [player, setPlayer] = useState<MyPlayerProps>(myPlayer());

  const [animuInfo, setAnimuInfo] = useState<AnimuInfoProps | null>(null);

  const playerProvider: PlayerProviderType = useMemo(
    () => ({ player, setPlayer }),
    [player, setPlayer]
  );

  const animuInfoProvider = useMemo(
    () => ({ animuInfo, setAnimuInfo }),
    [animuInfo, setAnimuInfo]
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
              <Routes />
            </AnimuInfoContext.Provider>
          </PlayerContext.Provider>
        </Background>
      ) : (
        <Loading />
      )}
    </>
  );
}

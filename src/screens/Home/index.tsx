import React, {
  MutableRefObject,
  RefObject,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { ScrollView, Text, View } from "react-native";

import { AnimuInfoProps } from "../../api";
import { Background } from "../../components/Background";
import { styles } from "./styles";

import { SafeAreaView } from "react-native-safe-area-context";
import { ChooseBitrateSection } from "../../components/ChooseBitrateSection";
import { CountdownTimerText } from "../../components/CountdownTimerText";
import { Cover } from "../../components/Cover";
import { HeaderBar } from "../../components/HeaderBar";
import { Listeners } from "../../components/Listeners";
import { Live } from "../../components/Live";
import { Logo } from "../../components/Logo";
import { Program } from "../../components/Program";
import { Loading } from "../Loading";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BackgroundTimer from "react-native-background-timer";
import {
  checkIfUserIsStillInTheServerAndIfYesExtendSession,
  logoutUserFromTheServer,
} from "../../components/CustomDrawer";
import { PopUpProgram } from "../../components/PopUpProgram";
import { AnimuInfoContext } from "../../contexts/animuinfo.context";
import { PlayerContext } from "../../contexts/player.context";
import { DiscordUser, UserContext } from "../../contexts/user.context";
import { RootStackParamList } from "../../routes/app.routes";

export const getUserSavedDataOrNull = async () => {
  try {
    const user = await AsyncStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  } catch (e) {
    return null;
  }
};

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function Home({ route, navigation }: Props) {
  const playerProvider = useContext(PlayerContext);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const userContext = useContext(UserContext);

  const userRefPHPSESSID: MutableRefObject<DiscordUser | null> =
    useRef<DiscordUser>(null);

  if (playerProvider?.player) {
    const player = playerProvider.player;

    let auxData: AnimuInfoProps | null = null;

    const animuInfoContext = useContext(AnimuInfoContext);
    if (!animuInfoContext) {
      throw new Error("AnimuInfoContext is null");
    }
    const { animuInfo, setAnimuInfo } = animuInfoContext;

    useEffect(() => {
      BackgroundTimer.runBackgroundTimer(async () => {
        auxData = await player.getCurrentMusic();
        setAnimuInfo(auxData);
        await player.updateMetadata();

        if (userRefPHPSESSID.current !== null && userContext) {
          const user = userRefPHPSESSID.current;
          const isUserStillInServer =
            await checkIfUserIsStillInTheServerAndIfYesExtendSession(user);
          if (!isUserStillInServer) {
            // Logout user from the app
            await AsyncStorage.removeItem("user");
            userContext.setUser(null);
          }
        }
      }, 5000);
      setInterval(() => {
        player.currentProgress = player.currentInformation?.track.timestart
          ? Date.now() - player.currentInformation?.track.timestart
          : 0;
        if (player.currentInformation) {
          setAnimuInfo({
            ...player.currentInformation,
            track: {
              ...player.currentInformation.track,
              progress: player.currentProgress,
            },
          });
        }
      }, 1000);
      return () => {
        BackgroundTimer.stopBackgroundTimer();
      };
    }, []);

    useEffect(() => {
      // clear all local storage
      // AsyncStorage.clear();
      // if (userContext && userContext.user)
      //   logoutUserFromTheServer(userContext.user);

      getUserSavedDataOrNull()
        .then((user) => {
          if (userContext && user) {
            userContext.setUser(user);
          }
        })
        .catch((e) => {
          console.error(e);
        });
    }, []);

    useEffect(() => {
      if (userContext?.user) {
        userRefPHPSESSID.current = userContext.user;
      }
    }, [userContext?.user]);

    return (
      <Background>
        {animuInfo ? (
          <SafeAreaView style={styles.container}>
            <ScrollView>
              <HeaderBar player={player} navigation={navigation} />
              <View style={styles.containerApp}>
                <Logo size={127} />
                <Listeners info={animuInfo} />
                <Cover cover={animuInfo.track.artworks.cover} />
                {!animuInfo?.program?.isLiveProgram && (
                  <Text style={styles.timeLeft}>
                    Tempo restante:{" "}
                    <CountdownTimerText
                      startTime={
                        animuInfo.track.duration - player.currentProgress
                      }
                    />
                  </Text>
                )}
                <Live track={animuInfo.track} />
                <Program
                  program={animuInfo.program}
                  handleClick={() => {
                    setIsModalVisible(true);
                  }}
                />
                <ChooseBitrateSection player={player} />
              </View>
            </ScrollView>
            {player._currentStream.category !== "REPRISES" && (
              <PopUpProgram
                visible={isModalVisible}
                program={animuInfo.program}
                handleClose={() => {
                  setIsModalVisible(false);
                }}
              />
            )}
          </SafeAreaView>
        ) : (
          <Loading />
        )}
      </Background>
    );
  }
}

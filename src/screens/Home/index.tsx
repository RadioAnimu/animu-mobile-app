import React, { useEffect, useState, useContext } from "react";
import { Text, View, ScrollView } from "react-native";

import { styles } from "./styles";
import { Background } from "../../components/Background";
import { AnimuInfoProps } from "../../api";

import { HeaderBar } from "../../components/HeaderBar";
import { Loading } from "../Loading";
import { Logo } from "../../components/Logo";
import { Listeners } from "../../components/Listeners";
import { Cover } from "../../components/Cover";
import { Live } from "../../components/Live";
import { Program } from "../../components/Program";
import { CountdownTimerText } from "../../components/CountdownTimerText";
import { ChooseBitrateSection } from "../../components/ChooseBitrateSection";
import { SafeAreaView } from "react-native-safe-area-context";

import BackgroundTimer from "react-native-background-timer";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../routes/app.routes";
import { PlayerContext } from "../../contexts/player.context";
import { PopUpProgram } from "../../components/PopUpProgram";
import { AnimuInfoContext } from "../../contexts/animuinfo.context";
import { checkIfUserIsStillInTheServerAndIfYesExtendSession } from "../../components/CustomDrawer";
import { UserContext } from "../../contexts/user.context";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
        if (userContext?.user) {
          const user = userContext.user;
          const isUserStillInServer =
            await checkIfUserIsStillInTheServerAndIfYesExtendSession(user);
          if (!isUserStillInServer) {
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

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

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function Home({ route, navigation }: Props) {
  const playerProvider = useContext(PlayerContext);
  if (playerProvider?.player) {
    const player = playerProvider.player;

    const [animuInfo, setAnimuInfo] = useState<AnimuInfoProps | null>(null);
    let auxData: AnimuInfoProps | null = null;

    useEffect(() => {
      BackgroundTimer.runBackgroundTimer(async () => {
        auxData = await player.getCurrentMusic();
        setAnimuInfo(auxData);
        player.player.updateNowPlayingMetadata(
          await player.getCurrentMusicInNowPlayingMetadataFormat()
        );
      }, 5000);
      setInterval(() => {
        player.currentProgress = player.currentMusic?.track.timestart
          ? Date.now() - player.currentMusic?.track.timestart
          : 0;
        if (player.currentMusic) {
          setAnimuInfo({
            ...player.currentMusic,
            track: {
              ...player.currentMusic.track,
              progress: player.currentProgress,
            },
          });
        }
      }, 1000);
    }, []);

    return (
      <Background>
        {animuInfo ? (
          <SafeAreaView style={styles.container}>
            <ScrollView>
              <HeaderBar info={animuInfo} player={player} />
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
                <Program info={animuInfo} />
                <ChooseBitrateSection player={player} />
              </View>
            </ScrollView>
          </SafeAreaView>
        ) : (
          <Loading />
        )}
      </Background>
    );
  }
}

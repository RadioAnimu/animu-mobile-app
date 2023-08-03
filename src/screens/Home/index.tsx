import React, { useEffect, useRef, useState } from "react";
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
import { myPlayer } from "../../utils";
import { SafeAreaView } from "react-native-safe-area-context";

import BackgroundTimer from "react-native-background-timer";

export function Home() {
  const [animuInfo, setAnimuInfo] = useState<AnimuInfoProps | null>(null);
  const isFirstRun = useRef(true);
  const player = useRef(myPlayer());
  let auxData: AnimuInfoProps | null = null;

  useEffect(() => {
    if (isFirstRun.current) {
      player.current.play().then(() => {
        BackgroundTimer.runBackgroundTimer(() => {
          async function getAnimuInfo() {
            auxData = await player.current.getCurrentMusic();
            setAnimuInfo(auxData);
            player.current.player.updateNowPlayingMetadata(
              await player.current.getCurrentMusicInNowPlayingMetadataFormat()
            );
          }
          if (player.current._loaded) {
            getAnimuInfo();
          }
        }, 5000);
      });
      setInterval(() => {
        if (player.current._loaded) {
          console.log("Updating current progress");
          player.current.currentProgress = player.current.currentMusic?.track
            .timestart
            ? Date.now() - player.current.currentMusic?.track.timestart
            : 0;
          if (player.current.currentMusic) {
            setAnimuInfo({
              ...player.current.currentMusic,
              track: {
                ...player.current.currentMusic.track,
                progress: player.current.currentProgress,
              },
            });
          }
        }
      }, 1000);
      isFirstRun.current = false;
    }
  }, []);

  const webViewRef = useRef(null);

  return (
    <Background>
      {animuInfo ? (
        <SafeAreaView style={styles.container}>
          <ScrollView>
            <HeaderBar info={animuInfo} player={player.current} />
            <View style={styles.containerApp}>
              <View style={styles.oscilloscopeAndLogo}>
                {/* <Oscilloscope player={player.current} webViewRef={webViewRef} /> */}
                <Logo size={127} />
              </View>
              <Listeners info={animuInfo} />
              <Cover cover={animuInfo.track.artworks.cover} />
              {!animuInfo?.program?.isLiveProgram && (
                <Text style={styles.timeLeft}>
                  Tempo restante:{" "}
                  <CountdownTimerText
                    startTime={
                      animuInfo.track.duration - player.current.currentProgress
                    }
                  />
                </Text>
              )}
              <Live track={animuInfo.track} />
              <Program info={animuInfo} />
              <ChooseBitrateSection player={player.current} />
            </View>
          </ScrollView>
        </SafeAreaView>
      ) : (
        <Loading />
      )}
    </Background>
  );
}

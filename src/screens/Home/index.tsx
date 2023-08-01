import React, { useEffect, useRef, useState } from "react";
import { Dimensions, Platform, Text, View } from "react-native";

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
import { Oscilloscope } from "../../components/Oscilloscope";

import notifee from '@notifee/react-native';

const default_cover =
  "https://cdn.discordapp.com/attachments/634406949198364702/1093233650025377892/Animu-3-anos-nova-logo.png";

export function Home() {
  const [animuInfo, setAnimuInfo] = useState<AnimuInfoProps | null>(null);
  const [cover, setCover] = useState<string>(default_cover);
  const isFirstRun = useRef(true);
  const player = useRef(myPlayer());
  let auxData;

   async function onDisplayNotification() {
    // Request permissions (required for iOS)
    await notifee.requestPermission()

    // Create a channel (required for Android)
    const channelId = await notifee.createChannel({
      id: 'default',
      name: 'Default Channel',
    });

    // Display a notification
    await notifee.displayNotification({
      title: 'Notification Title',
      body: 'Main body content of the notification',
      android: {
        channelId,
        smallIcon: 'name-of-a-small-icon', // optional, defaults to 'ic_launcher'.
        // pressAction is needed if you want the notification to open the app when pressed
        pressAction: {
          id: 'default',
        },
      },
    });
  }

  useEffect(() => {
    if (isFirstRun.current) {
        setInterval(() => {
          function isUrlAnImage(url: string) {
            return url.match(/\.(jpeg|jpg|gif|png)$/) != null;
          }
          async function getAnimuInfo() {
            auxData = await player.current.getCurrentMusic();
            if (auxData.track != animuInfo?.track) {
              setAnimuInfo(auxData);
            }
            const cover =
              auxData.track.artworks.large ||
              auxData.track.artworks.medium ||
              auxData.track.artworks.tiny ||
              default_cover;
            if (isUrlAnImage(cover)) {
              setCover(cover);
            } else {
              setCover(default_cover);
            }
          }
          getAnimuInfo();
        }, 1000);
        onDisplayNotification();
     // player.current.play();
      isFirstRun.current = false;
    }
  }, []);

  const webViewRef = useRef(null);

  return (
    <Background>
      {animuInfo ? (
        <SafeAreaView style={styles.container}>
          <HeaderBar player={player.current} />
          <View style={styles.containerApp}>
            <View style={styles.oscilloscopeAndLogo}>
                <Oscilloscope player={player.current} webViewRef={webViewRef} />
                <Logo size={127} />
            </View>
            <Listeners info={animuInfo} />
            <Cover cover={cover} />
            {!animuInfo.track.isLiveProgram && (
              <Text style={styles.timeLeft}>
                Tempo restante:{" "}
                <CountdownTimerText
                  startTime={
                    animuInfo.track.duration -
                    (Date.now() - animuInfo.track.timestart)
                  }
                />
              </Text>
            )}
            <Live track={animuInfo.track} />
            <Program info={animuInfo} />
            <ChooseBitrateSection player={player.current} />
          </View>
        </SafeAreaView>
      ) : (
        <Loading />
      )}
    </Background>
  );
}

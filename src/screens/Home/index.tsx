import React, { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

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
import { WebView } from 'react-native-webview';

const default_cover =
  "https://cdn.discordapp.com/attachments/634406949198364702/1093233650025377892/Animu-3-anos-nova-logo.png";

export function Home() {
  const [animuInfo, setAnimuInfo] = useState<AnimuInfoProps | null>(null);
  const [cover, setCover] = useState<string>(default_cover);
  const isFirstRun = useRef(true);
  const player = useRef(myPlayer());
  let auxData;

  useEffect(() => {
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
/*
    if (isFirstRun.current) {
      player.current.play();
      isFirstRun.current = false;
    }
*/
  }, []);

const debugging = `
  const consoleLog = (type, log) => window.ReactNativeWebView.postMessage(JSON.stringify({'type': 'Console', 'data': {'type': type, 'log': log}}));
  console = {
      log: (log) => consoleLog('log', log),
      debug: (log) => consoleLog('debug', log),
      info: (log) => consoleLog('info', log),
      warn: (log) => consoleLog('warn', log),
      error: (log) => consoleLog('error', log),
    };
`;

const onMessage = (payload: any) => {
  let dataPayload;
  try {
    dataPayload = JSON.parse(payload.nativeEvent.data);
  } catch (e) {}

  if (dataPayload) {
    if (dataPayload.type === 'Console') {
      console.info(`[Console] ${JSON.stringify(dataPayload.data)}`);
    } else {
      console.log(dataPayload)
    }
  }
};

/*
  return (
    <Background>
      {animuInfo ? (
        <SafeAreaView style={styles.container}>
          <HeaderBar player={player.current} />
          <View style={styles.containerApp}>
            <Logo size={127} />
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
  */

    const html2 = `<iframe src="./../../assets/html/index.html" width="100%" height="100%" frameborder="0" allowfullscreen></iframe>`;

    return (
         <WebView
            source={{ html: html2 }}
            javaScriptEnabled={true}
            onMessage={onMessage}
            injectedJavaScript={debugging}
          />
    )
}

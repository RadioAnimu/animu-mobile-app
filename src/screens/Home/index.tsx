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

const default_cover = "https://cdn.discordapp.com/attachments/634406949198364702/1093233650025377892/Animu-3-anos-nova-logo.png";

export function Home() {
  const [animuInfo, setAnimuInfo] = useState<AnimuInfoProps | null>(null);
  const [cover, setCover] = useState<string>(default_cover);
  const isFirstRun = useRef(true);
  const player = useRef(myPlayer()); 
  


  useEffect(() => {
            setInterval(() => {
                function isUrlAnImage(url: string) {
                    return(url.match(/\.(jpeg|jpg|gif|png)$/) != null);
                }
                async function getAnimuInfo() {
                    const data = await player.current.getCurrentMusic(); 
                    if (data.track != animuInfo?.track) {
                        setAnimuInfo(data);
                    }
                    const cover = (data.track.artworks.large || data.track.artworks.medium || data.track.artworks.tiny || default_cover);
                    if (isUrlAnImage(cover)) {
                        setCover(cover);
                    } else {
                        setCover(default_cover);
                    }
                }
                getAnimuInfo();
          }, 1000);

        if (isFirstRun.current) {

          player.current.play();
          isFirstRun.current = false;
        }
  }, []);


  return (
    <Background>
      {animuInfo ? (
          <View style={styles.container}>
            <HeaderBar player={player.current} />
            <Logo size={127} />
            <View style={styles.information}>
                <Listeners listeners={animuInfo.listeners} />
                <Cover cover={cover} />
                <Text style={styles.timeLeft}>Tempo restante: <CountdownTimerText 
                    startTime={animuInfo.track.duration - (Date.now() - animuInfo.track.timestart)}
                    /></Text>
                <Live track={animuInfo.track} />
                <Program info={animuInfo} />
                <ChooseBitrateSection  player={player.current} />
            </View>
          </View>
      ) : (
        <Loading />
      )}
    </Background>
  );
}

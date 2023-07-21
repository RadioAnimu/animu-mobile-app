import React, { useEffect, useRef, useState } from "react";
import { Image, Text, View } from "react-native";

import { styles } from "./styles";
import { Background } from "../../components/Background";
import { API, AnimuInfoProps } from "../../api";

import { useNavigation } from "@react-navigation/native";
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
  const navigation = useNavigation();
  const [animuInfo, setAnimuInfo] = useState<AnimuInfoProps | null>(null);
  const [cover, setCover] = useState<string>(default_cover);
  const isFirstRun = useRef(true);
  const player = useRef(myPlayer()); 

  useEffect(() => {
        function fetchCurrentData() {
              fetch(API.BASE_URL)
              .then((response) => response.json())
              .then((data: AnimuInfoProps) => {
                      data.track.rawtitle = data.rawtitle;
                      data.track.song = data.rawtitle.split(" | ")[0].trim() || data.rawtitle;
                      data.track.anime = data.rawtitle.split(" | ")[1].trim() || "Tocando Agora";
                      data.track.artist = data.track.song.split(" - ")[0].trim() || data.track.artist;
                      data.track.song = data.track.song.split(" - ")[1].trim() || data.track.song;
                      setAnimuInfo(data);
                      setCover(data.track.artworks.large || data.track.artworks.medium || data.track.artworks.tiny || default_cover);
                      });
          }

        setInterval(() => {
            fetchCurrentData();
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
            <HeaderBar />
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

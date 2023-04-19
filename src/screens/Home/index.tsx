import React, { useEffect, useState } from "react";
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
import { ButtonKBPS } from "../../components/ButtonKBPS";

const default_cover = "https://cdn.discordapp.com/attachments/634406949198364702/1093233650025377892/Animu-3-anos-nova-logo.png";

const bitrates = [
    {
        category: "MP3",
        kbps: 320,
        selected: true,
    },
    {
        category: "MP3",
        kbps: 192,
    },
    {
        category: "AAC+",
        kbps: 64,
    }
];

export function Home() {
  const navigation = useNavigation();
  const [animuInfo, setAnimuInfo] = useState<AnimuInfoProps | null>(null);
  const [cover, setCover] = useState<string>(default_cover);

  useEffect(() => {
    fetch(`${API.BASE_URL}`)
      .then((response) => response.json())
      .then((data: AnimuInfoProps) => {
        data.track.rawtitle = data.rawtitle;
        setAnimuInfo(data);
        setCover(data.track.artworks.large || data.track.artworks.medium || data.track.artworks.tiny || default_cover);
      });
  }, []);

  console.log(animuInfo);

  return (
    <Background>
      {animuInfo ? (
          <View style={styles.container}>
            <HeaderBar />
            <Logo size={127} />
            <View style={styles.information}>
                <Listeners listeners={animuInfo.listeners} />
                <Cover cover={cover} />
                <Text style={styles.timeLeft}>Tempo restante: 1:56</Text>{/* Todo: Change to component, and do the actual script */}
                <Live track={animuInfo.track} />
                <Program info={animuInfo} />
                <View style={styles.buttons}>
                    {bitrates.map((bitrate, index) => (
                        <ButtonKBPS key={index} selected={bitrate.selected || false} category={bitrate.category} kbps={bitrate.kbps} />
                    ))}
                </View>
            </View>
          </View>
      ) : (
        <Loading />
      )}
    </Background>
  );
}

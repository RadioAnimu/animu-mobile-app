import React, { useContext, useEffect, useState } from "react";
import { FlatList, Image, Text, View } from "react-native";

import { AnimuInfoProps } from "../../api";
import { Background } from "../../components/Background";
import { styles } from "./styles";

import { SafeAreaView } from "react-native-safe-area-context";
import { HeaderBar } from "../../components/HeaderBar";
import { Loading } from "../Loading";

import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PlayerContext } from "../../contexts/player.context";
import { RootStackParamList } from "../../routes/app.routes";

import UltimasPedidasImage from "../../assets/ultimos_pedidas-haru.png";

type Props = NativeStackScreenProps<RootStackParamList, "UltimasPedidas">;

export function UltimasPedidas({ route, navigation }: Props) {
  const playerProvider = useContext(PlayerContext);

  if (playerProvider?.player) {
    const player = playerProvider.player;

    const [animuInfo, setAnimuInfo] = useState<AnimuInfoProps | null>(null);
    const [ultimasPedidas, setUltimasPedidas] = useState<
      AnimuInfoProps["ultimasPedidas"]
    >([]);
    let auxData: AnimuInfoProps | null = null;

    useEffect(() => {
      setUltimasPedidas(player.currentInformation?.ultimasPedidas || []);
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
        setUltimasPedidas(player.currentInformation?.ultimasPedidas || []);
      }, 1000);
    }, []);

    return (
      <Background>
        {animuInfo ? (
          <SafeAreaView style={styles.container}>
            <View
              style={{
                height: "100%",
                paddingBottom: 15,
              }}
            >
              <HeaderBar
                info={animuInfo}
                player={player}
                navigation={navigation}
              />
              <View style={styles.containerApp}>
                <Image
                  source={UltimasPedidasImage}
                  style={styles.ultimasPedidasImage}
                />
              </View>
              <FlatList
                data={ultimasPedidas}
                keyExtractor={(item, index) => item.rawtitle}
                contentContainerStyle={styles.containerList}
                renderItem={({ item }) => (
                  <View style={styles.metadata}>
                    <Image
                      source={{
                        uri: item.artworks.cover,
                      }}
                      style={styles.image}
                    />
                    <Text style={styles.musicapedidaname}>{item.rawtitle}</Text>
                    <Text style={styles.musicapedidatime}>
                      {new Date(item.timestart).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </Text>
                  </View>
                )}
              />
            </View>
          </SafeAreaView>
        ) : (
          <Loading />
        )}
      </Background>
    );
  }
}

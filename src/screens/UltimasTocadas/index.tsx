import React, { useContext, useEffect, useState } from "react";
import { FlatList, Image, Text, View } from "react-native";

import { AnimuInfoProps } from "../../api";
import { Background } from "../../components/Background";
import { styles } from "./styles";

import { SafeAreaView } from "react-native-safe-area-context";
import { HeaderBar } from "../../components/HeaderBar";

import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PlayerContext } from "../../contexts/player.context";
import { RootStackParamList } from "../../routes/app.routes";

import UltimasTocadasImage from "../../assets/ultimas_tocadas-haru.png";
import { CONFIG } from "../../utils/player.config";

type Props = NativeStackScreenProps<RootStackParamList, "UltimasTocadas">;

export function UltimasTocadas({ route, navigation }: Props) {
  const playerProvider = useContext(PlayerContext);

  if (playerProvider?.player) {
    const player = playerProvider.player;

    const [ultimasTocadas, setUltimasTocadas] = useState<
      AnimuInfoProps["ultimasTocadas"]
    >([]);

    const ultimasTocadasRef: React.MutableRefObject<
      AnimuInfoProps["ultimasTocadas"]
    > = React.useRef(ultimasTocadas);

    useEffect(() => {
      setUltimasTocadas(player.currentInformation?.ultimasTocadas || []);
      setInterval(() => {
        if (
          ultimasTocadasRef.current.length !==
          player.currentInformation?.ultimasTocadas.length
        ) {
          console.log("Atualizando ultimas tocadas");
          ultimasTocadasRef.current = JSON.parse(
            JSON.stringify(player.currentInformation?.ultimasTocadas)
          );
          console.log(player.currentInformation?.ultimasTocadas);
          setUltimasTocadas(player.currentInformation?.ultimasTocadas || []);
        }
      }, 1000);
    }, []);

    return (
      <Background>
        <SafeAreaView style={styles.container}>
          <View
            style={{
              height: "100%",
              paddingBottom: 15,
            }}
          >
            <HeaderBar player={player} navigation={navigation} />
            <View style={styles.containerApp}>
              <Image
                source={UltimasTocadasImage}
                style={styles.ultimasPedidasImage}
              />
            </View>
            <FlatList
              data={ultimasTocadas}
              keyExtractor={(item, index) => item.rawtitle + index}
              contentContainerStyle={styles.containerList}
              extraData={ultimasTocadas}
              renderItem={({ item }) => (
                <View style={styles.metadata}>
                  <Image
                    source={{
                      uri: item.artworks.cover,
                    }}
                    defaultSource={{
                      uri: CONFIG.DEFAULT_COVER,
                    }}
                    style={styles.image}
                  />
                  <Text style={styles.musicapedidaname}>{item.rawtitle}</Text>
                </View>
              )}
            />
          </View>
        </SafeAreaView>
      </Background>
    );
  }
}

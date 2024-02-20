import React, { useContext } from "react";
import { FlatList, Image, Text, View } from "react-native";

import { Background } from "../../components/Background";
import { styles } from "./styles";

import { CONFIG } from "../../utils/player.config";

import { SafeAreaView } from "react-native-safe-area-context";
import { HeaderBar } from "../../components/HeaderBar";

import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PlayerContext } from "../../contexts/player.context";
import { RootStackParamList } from "../../routes/app.routes";

import UltimasPedidasImage from "../../assets/ultimos_pedidas-haru.png";
import { AnimuInfoContext } from "../../contexts/animuinfo.context";
import { Loading } from "../Loading";

type Props = NativeStackScreenProps<
  RootStackParamList,
  "UltimasPedidas" | "UltimasTocadas"
>;

export function Ultimas({ route, navigation }: Props) {
  const playerProvider = useContext(PlayerContext);
  const { type } = route.params;
  const isUltimasPedidasScreen = type === "pedidas";

  if (playerProvider?.player) {
    const player = playerProvider.player;

    const animuInfoContext = useContext(AnimuInfoContext);
    if (!animuInfoContext) {
      throw new Error("AnimuInfoContext is null");
    }
    const { animuInfo } = animuInfoContext;

    return (
      <Background>
        {animuInfo ? (
          <SafeAreaView style={styles.container}>
            <HeaderBar player={player} navigation={navigation} />
            <View style={styles.appContainer}>
              <Image
                source={UltimasPedidasImage}
                style={styles.ultimasPedidasImage}
              />
              <View
                style={{
                  width: "100%",
                  flex: 1,
                }}
              >
                <FlatList
                  data={
                    isUltimasPedidasScreen
                      ? animuInfo.ultimasPedidas
                      : animuInfo.ultimasTocadas
                  }
                  keyExtractor={(item, index) => item.rawtitle + index}
                  contentContainerStyle={styles.containerList}
                  extraData={animuInfo.ultimasPedidas}
                  renderItem={({ item }) => (
                    <View style={styles.metadata}>
                      <Image
                        source={{
                          uri: item.artworks.cover,
                        }}
                        style={styles.image}
                        defaultSource={{
                          uri: CONFIG.DEFAULT_COVER,
                        }}
                      />
                      <Text style={styles.musicapedidaname}>
                        {item.rawtitle}
                      </Text>
                      {isUltimasPedidasScreen && (
                        <Text style={styles.musicapedidatime}>
                          {new Date(item.timestart).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                        </Text>
                      )}
                    </View>
                  )}
                />
              </View>
            </View>
          </SafeAreaView>
        ) : (
          <Loading />
        )}
      </Background>
    );
  }
}

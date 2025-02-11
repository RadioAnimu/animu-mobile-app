import React, { useContext, useState } from "react";
import { FlatList, Text, View } from "react-native";

import { Background } from "../../components/Background";
import { styles } from "./styles";

import { CONFIG } from "../../utils/player.config";

import { SafeAreaView } from "react-native-safe-area-context";
import { HeaderBar } from "../../components/HeaderBar";

import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../routes/app.routes";

import { Image } from "expo-image";
import { IMGS } from "../../languages";
import { Loading } from "../Loading";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { usePlayer } from "../../contexts/player/PlayerProvider";
import { AnimuInfoProps, TrackProps } from "../../api";

type Props = NativeStackScreenProps<
  RootStackParamList,
  "UltimasPedidas" | "UltimasTocadas"
>;

export function Ultimas({ route, navigation }: Props) {
  const { type } = route.params;
  const isUltimasPedidasScreen = type === "pedidas";

  const player = usePlayer();

  const { settings } = useUserSettings();

  const [isLiveRequestModalVisible, setIsLiveRequestModalVisible] =
    useState<boolean>(false);

  const openLiveRequestModal = () => {
    setIsLiveRequestModalVisible(true);
  };

  return (
    <Background>
      {player ? (
        <SafeAreaView style={styles.container}>
          <HeaderBar
            openLiveRequestModal={openLiveRequestModal}
            navigation={navigation}
          />
          <View style={styles.appContainer}>
            <Image
              source={
                isUltimasPedidasScreen
                  ? IMGS[settings.selectedLanguage].LAST_REQUEST
                  : IMGS[settings.selectedLanguage].LAST_PLAYED
              }
              style={styles.ultimasPedidasImage}
              contentFit="contain"
              cachePolicy={"none"}
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
                    ? // animuInfo.ultimasPedidas
                      ([] as TrackProps[])
                    : // animuInfo.ultimasTocadas
                      ([] as TrackProps[])
                }
                keyExtractor={(item, index) => item.rawtitle + index}
                contentContainerStyle={styles.containerList}
                extraData={
                  isUltimasPedidasScreen
                    ? // animuInfo.ultimasPedidas
                      ([] as TrackProps[])
                    : // animuInfo.ultimasTocadas
                      ([] as TrackProps[])
                }
                renderItem={({ item }) => (
                  <View style={styles.metadata}>
                    {(isUltimasPedidasScreen && settings.lastRequestedCovers) ||
                    (!isUltimasPedidasScreen && settings.lastPlayedCovers) ? (
                      <Image
                        source={{
                          uri: item.artworks.cover || CONFIG.DEFAULT_COVER,
                        }}
                        style={styles.image}
                        placeholder={{
                          uri: CONFIG.DEFAULT_COVER,
                        }}
                        onError={() => {
                          return {
                            uri: CONFIG.DEFAULT_COVER,
                          };
                        }}
                        cachePolicy={settings.cacheEnabled ? "disk" : "none"}
                        contentFit="cover"
                      />
                    ) : (
                      <></>
                    )}
                    <Text style={styles.musicapedidaname}>{item.rawtitle}</Text>
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

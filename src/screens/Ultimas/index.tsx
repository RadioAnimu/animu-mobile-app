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
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { usePlayer } from "../../contexts/player/PlayerProvider";

type Props = NativeStackScreenProps<
  RootStackParamList,
  "LastRequested" | "LastPlayed"
>;

export function Last({ route, navigation }: Props) {
  const { historyType } = route.params;
  const isUltimasPedidasScreen = historyType === "requests";

  const player = usePlayer();

  const { settings } = useUserSettings();

  return (
    <Background>
      <SafeAreaView style={styles.container}>
        <HeaderBar navigation={navigation} />
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
                  ? player.lastRequestedTracks
                  : player.lastPlayedTracks
              }
              keyExtractor={(item, index) => item.raw + index}
              contentContainerStyle={styles.containerList}
              extraData={
                isUltimasPedidasScreen
                  ? player.lastRequestedTracks
                  : player.lastPlayedTracks
              }
              renderItem={({ item }) => (
                <View style={styles.metadata}>
                  {(isUltimasPedidasScreen && settings.lastRequestedCovers) ||
                  (!isUltimasPedidasScreen && settings.lastPlayedCovers) ? (
                    <Image
                      source={{
                        uri: item.artwork,
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
                  <Text style={styles.musicapedidaname}>{item.raw}</Text>
                  {isUltimasPedidasScreen && (
                    <Text style={styles.musicapedidatime}>
                      {new Date(item.startTime).toLocaleTimeString([], {
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
    </Background>
  );
}

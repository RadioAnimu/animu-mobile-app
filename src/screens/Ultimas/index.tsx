import React from "react";
import { FlatList, Text, View } from "react-native";

import { Background } from "../../components/Background";
import { styles } from "./styles";

import { SafeAreaView } from "react-native-safe-area-context";
import { HeaderBar } from "../../components/HeaderBar";
import { Cover } from "../../components/Cover";

import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../routes/app.routes";

import { Image } from "expo-image";
import { IMGS } from "../../i18n";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { useStation } from "../../contexts/player/PlayerProvider";

type Props = NativeStackScreenProps<
  RootStackParamList,
  "LastRequested" | "LastPlayed"
>;

export function Last({ route, navigation }: Props) {
  const { historyType } = route.params;
  const isUltimasPedidasScreen = historyType === "requests";

  const station = useStation();

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
                  ? station.lastRequestedTracks
                  : station.lastPlayedTracks
              }
              keyExtractor={(item, index) => item.raw + index}
              contentContainerStyle={styles.containerList}
              extraData={
                isUltimasPedidasScreen
                  ? station.lastRequestedTracks
                  : station.lastPlayedTracks
              }
              renderItem={({ item }) => (
                <View style={styles.metadata}>
                  {(isUltimasPedidasScreen && settings.lastRequestedCovers) ||
                  (!isUltimasPedidasScreen && settings.lastPlayedCovers) ? (
                    <Cover cover={item.artwork} style={styles.image} />
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

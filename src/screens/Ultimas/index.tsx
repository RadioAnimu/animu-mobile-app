import React from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";
import * as Clipboard from "expo-clipboard";

import { Background } from "../../components/Background";
import { styles } from "./styles";

import { SafeAreaView } from "react-native-safe-area-context";
import { HeaderBar } from "../../components/HeaderBar";
import { Cover } from "../../components/Cover";

import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../routes/app.routes";

import { Image } from "expo-image";
import { DICT, IMGS } from "../../i18n";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { useStation } from "../../contexts/player/PlayerProvider";
import { useAlert } from "../../contexts/alert/AlertProvider";

type Props = NativeStackScreenProps<
  RootStackParamList,
  "LastRequested" | "LastPlayed"
>;

export function Last({ route, navigation }: Props) {
  const { historyType } = route.params;
  const isUltimasPedidasScreen = historyType === "requests";

  const station = useStation();
  const { toast } = useAlert();

  const { settings } = useUserSettings();

  const copyText = (text: string) => {
    Clipboard.setStringAsync(text);
    toast(DICT[settings.selectedLanguage].TEXT_COPIED);
  };

  return (
    <Background>
      <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
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
          <View style={styles.listWrapper}>
            <FlatList
              data={
                isUltimasPedidasScreen
                  ? station.lastRequestedTracks
                  : station.lastPlayedTracks
              }
              keyExtractor={(item) =>
                `${item.raw}-${new Date(item.startTime).getTime()}`
              }
              contentContainerStyle={styles.containerList}
              renderItem={({ item }) => (
                <View style={styles.metadata}>
                  {(isUltimasPedidasScreen && settings.lastRequestedCovers) ||
                  (!isUltimasPedidasScreen && settings.lastPlayedCovers) ? (
                    <Cover
                      cover={item.artwork}
                      style={styles.image}
                      recyclingKey={`${item.raw}-${new Date(item.startTime).getTime()}`}
                    />
                  ) : (
                    <></>
                  )}
                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.7}
                    onPress={() => copyText(item.raw)}
                    style={styles.nameTouchable}
                  >
                    <Text style={styles.musicapedidaname}>{item.raw}</Text>
                  </TouchableOpacity>
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

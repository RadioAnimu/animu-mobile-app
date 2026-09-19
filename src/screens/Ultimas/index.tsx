import { useCallback, useMemo } from "react";
import {
  FlatList,
  Text,
  TouchableOpacity,
  View,
  type ListRenderItem,
} from "react-native";
import * as Clipboard from "expo-clipboard";

import { Background } from "@/components/Background";
import { styles } from "@/screens/Ultimas/styles";

import { SafeAreaView } from "react-native-safe-area-context";
import { HeaderBar } from "@/components/HeaderBar";
import { Cover } from "@/components/Cover";

import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/routes/app.routes";

import { Image } from "expo-image";
import { IMGS } from "@/i18n";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useDict } from "@/hooks/useDict";
import { useStation } from "@/contexts/player/PlayerProvider";
import type { StationSnapshot } from "@/core/player";
import { useAlert } from "@/contexts/alert/AlertProvider";

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
  const dict = useDict();

  const copyText = useCallback(
    (text: string) => {
      Clipboard.setStringAsync(text);
      toast(dict.TEXT_COPIED);
    },
    [toast, dict],
  );

  const renderItem: ListRenderItem<
    NonNullable<StationSnapshot["lastRequestedTracks"]>[number]
  > = useCallback(
    ({ item }) =>
      (
        <View style={styles.metadata}>
          {(isUltimasPedidasScreen && settings.lastRequestedCovers) ||
          (!isUltimasPedidasScreen && settings.lastPlayedCovers) ? (
            <Cover
              cover={item.artwork}
              style={styles.image}
              recyclingKey={`${item.raw}-${new Date(item.startTime).getTime()}`}
              category={isUltimasPedidasScreen ? "requested" : "played"}
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
      ),
    [
      copyText,
      isUltimasPedidasScreen,
      settings.lastRequestedCovers,
      settings.lastPlayedCovers,
    ],
  );

  const listData = useMemo(
    () =>
      isUltimasPedidasScreen
        ? station.lastRequestedTracks
        : station.lastPlayedTracks,
    [isUltimasPedidasScreen, station.lastRequestedTracks, station.lastPlayedTracks],
  );

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
              data={listData}
              keyExtractor={(item) =>
                `${item.raw}-${new Date(item.startTime).getTime()}`
              }
              contentContainerStyle={styles.containerList}
              renderItem={renderItem}
              // Rows wrap to show the full title, so they vary in height and
              // cannot be described by `getItemLayout`.
              // Lists hold ~dozens of rows; render a tight window
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={7}
            />
          </View>
        </View>
      </SafeAreaView>
    </Background>
  );
}

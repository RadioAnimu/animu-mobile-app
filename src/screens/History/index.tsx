import { useCallback, useMemo } from "react";
import {
  FlatList,
  Text,
  TouchableOpacity,
  View,
  type ListRenderItem,
} from "react-native";

import { Background } from "@/components/Background";
import { styles } from "@/screens/History/styles";

import { SafeAreaView } from "react-native-safe-area-context";
import { HeaderBar } from "@/components/HeaderBar";
import { Cover } from "@/components/Cover";

import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/routes/app.routes";

import { Image } from "expo-image";
import { IMGS } from "@/i18n";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useStation } from "@/contexts/player/PlayerProvider";
import type { StationSnapshot } from "@/core/player";

type Props = NativeStackScreenProps<
  RootStackParamList,
  "LastRequested" | "LastPlayed"
>;

export function History({ route }: Props) {
  const { historyType } = route.params;
  const isRequestHistory = historyType === "requests";

  const station = useStation();
  const { settings } = useUserSettings();
  const copyText = useCopyToClipboard();

  const renderItem: ListRenderItem<
    NonNullable<StationSnapshot["lastRequestedTracks"]>[number]
  > = useCallback(
    ({ item }) =>
      (
        <View style={styles.metadata}>
          {(isRequestHistory && settings.lastRequestedCovers) ||
          (!isRequestHistory && settings.lastPlayedCovers) ? (
            <Cover
              cover={item.artwork}
              style={styles.image}
              recyclingKey={`${item.raw}-${new Date(item.startTime).getTime()}`}
              category={isRequestHistory ? "requested" : "played"}
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
                <Text style={styles.trackName}>{item.raw}</Text>
          </TouchableOpacity>
          {isRequestHistory && (
            <Text style={styles.trackTime}>
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
      isRequestHistory,
      settings.lastRequestedCovers,
      settings.lastPlayedCovers,
    ],
  );

  const listData = useMemo(
    () =>
      isRequestHistory
        ? station.lastRequestedTracks
        : station.lastPlayedTracks,
    [isRequestHistory, station.lastRequestedTracks, station.lastPlayedTracks],
  );

  return (
    <Background>
      <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
        <HeaderBar />
        <View style={styles.appContainer}>
          <Image
            source={
              isRequestHistory
                ? IMGS[settings.selectedLanguage].LAST_REQUEST
                : IMGS[settings.selectedLanguage].LAST_PLAYED
            }
            style={styles.headerImage}
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

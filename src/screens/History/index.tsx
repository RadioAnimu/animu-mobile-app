import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
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

import { DrawerScreenProps } from "@react-navigation/drawer";
import { RootStackParamList } from "@/routes/app.routes";

import { Image } from "expo-image";
import { IMGS } from "@/i18n";
import { THEME } from "@/theme";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useDict } from "@/hooks/useDict";
import { usePlayer, useStation } from "@/contexts/player/PlayerProvider";
import type { StationSnapshot } from "@/core/player";

type Props = DrawerScreenProps<
  RootStackParamList,
  "LastRequested" | "LastPlayed"
>;

export function History({ route }: Props) {
  const { historyType } = route.params;
  const isRequestHistory = historyType === "requests";

  const station = useStation();
  const player = usePlayer();
  const { settings } = useUserSettings();
  const copyText = useCopyToClipboard();
  const dict = useDict();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // `refreshData` only re-fetches the requested feed; the played feed is
      // otherwise refreshed only on track change, so pull-to-refresh must ask
      // for the list currently on screen.
      if (isRequestHistory) {
        await player.refreshData();
      } else {
        await player.refreshHistory("played");
      }
    } finally {
      setRefreshing(false);
    }
  }, [player, isRequestHistory]);

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
            accessibilityHint={dict.TEXT_COPIED}
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
      dict.TEXT_COPIED,
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
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={THEME.COLORS.TEXT}
                  colors={[THEME.COLORS.BRAND]}
                  progressBackgroundColor={THEME.COLORS.SURFACE}
                />
              }
            />
          </View>
        </View>
      </SafeAreaView>
    </Background>
  );
}

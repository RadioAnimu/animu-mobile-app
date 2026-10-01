import { useCallback, useMemo, useState } from "react";
import { DrawerScreenProps } from "@react-navigation/drawer";
import { useFocusEffect } from "@react-navigation/native";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/ScreenHeader";
import {
  listenStatsService,
  type ListenStatsSnapshot,
} from "@/core/services/listen-stats.service";
import { useAuth } from "@/contexts/auth/AuthProvider";
import { useAlert } from "@/contexts/alert/AlertProvider";
import { useDict } from "@/hooks/useDict";
import { RootStackParamList } from "@/routes/app.routes";
import { ShareCardSection } from "@/screens/Stats/ShareCardSection";
import { StatsContent } from "@/screens/Stats/StatsContent";
import { styles } from "@/screens/Stats/styles";
import { THEME } from "@/theme";
import { haptics } from "@/utils/haptics";

type Props = DrawerScreenProps<RootStackParamList, "Stats">;

/**
 * On-device listening stats: the shareable listening card, overview,
 * six-month heatmap with day drill-down, streaks and an hour/weekday
 * listening profile. Everything shown is measured locally — nothing
 * leaves the phone.
 */
export function Stats({ navigation }: Props) {
  const dict = useDict();
  const { user, profile, imageVersion, refreshProfile } = useAuth();
  const { toast } = useAlert();
  const [refreshing, setRefreshing] = useState(false);
  const [snap, setSnap] = useState<ListenStatsSnapshot | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Drawer screens stay mounted, so the snapshot refreshes on every focus.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listenStatsService
        .initialize()
        .then(() => {
          if (alive) setSnap(listenStatsService.getSnapshot());
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, []),
  );

  // Pull to refresh: re-read the on-device stats and, when signed in, pull a
  // fresh profile so the card's avatar and banner update too.
  const refresh = useCallback(async () => {
    haptics.select();
    setRefreshing(true);
    try {
      await refreshProfile();
      await listenStatsService.initialize();
      setSnap(listenStatsService.getSnapshot());
      toast(dict.ACCOUNT_REFRESHED);
    } catch (error) {
      console.warn("[Stats] refresh failed:", error);
      toast(dict.STATS_CARD_FAILED);
    } finally {
      setRefreshing(false);
    }
  }, [dict, refreshProfile, toast]);

  const hasData = (snap?.totalMs ?? 0) > 0 || (snap?.totalSubmitted ?? 0) > 0;

  // The share card needs a snapshot the moment it is signed in, even before
  // the focus effect's first read resolves. Memoized off `snap` so the
  // fallback is built once (getSnapshot() re-reads/prunes the store — not
  // something to run on every render) and keeps a stable prop identity.
  const fallbackSnap = useMemo(
    () => (snap ? null : listenStatsService.getSnapshot()),
    [snap],
  );

  const handleReset = useCallback(async () => {
    await listenStatsService.reset();
    setSnap(listenStatsService.getSnapshot());
    setSelectedDay(null);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <ScreenHeader
        title={dict.STATS_TITLE}
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={THEME.COLORS.BRAND}
            colors={[THEME.COLORS.BRAND]}
            progressBackgroundColor={THEME.COLORS.SURFACE}
          />
        }
      >
        {/* The shareable card is always the hero — even with no stats yet
              (signed-out users get the unlock prompt instead). */}
        <ShareCardSection
          user={user}
          profile={profile}
          imageVersion={imageVersion}
          snap={snap ?? fallbackSnap!}
          onSignIn={() => navigation.navigate("Login")}
        />
        {hasData && snap ? (
          <StatsContent
            snap={snap}
            dict={dict}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            onReset={handleReset}
          />
        ) : (
          <View style={[styles.group, styles.emptyCard, styles.afterCardGap]}>
            <Text style={styles.emptyTitle}>{dict.STATS_EMPTY_TITLE}</Text>
            <Text style={styles.emptyText}>{dict.STATS_EMPTY}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

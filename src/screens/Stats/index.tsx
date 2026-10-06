import { useCallback, useMemo, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppRefreshControl } from "@/components/AppRefreshControl";
import { ScreenHeader } from "@/components/ScreenHeader";
import {
  listenStatsService,
  type ListenStatsSnapshot,
} from "@/core/services/listen-stats.service";
import { useAuth } from "@/contexts/auth/AuthProvider";
import { useAlert } from "@/contexts/alert/AlertProvider";
import { useDict } from "@/hooks/useDict";
import { useScrollEndPadding } from "@/hooks/useScrollEndPadding";
import type { RootStackParamList } from "@/routes/app.routes";
import { ShareCardSection } from "@/screens/Stats/ShareCardSection";
import { StatsContent } from "@/screens/Stats/StatsContent";
import { styles } from "@/screens/Stats/styles";

type Props = NativeStackScreenProps<RootStackParamList, "Stats">;

/**
 * On-device listening stats: the shareable listening card, overview,
 * six-month heatmap with day drill-down, streaks and an hour/weekday
 * listening profile. Everything shown is measured locally — nothing
 * leaves the phone.
 */
export function Stats({ navigation }: Readonly<Props>) {
  const dict = useDict();
  const endPadding = useScrollEndPadding();
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
    setRefreshing(true);
    try {
      await refreshProfile();
      await listenStatsService.initialize();
      setSnap(listenStatsService.getSnapshot());
      toast(dict.ACCOUNT_REFRESHED);
    } catch (error) {
      console.warn("[Stats] refresh failed:", error);
      toast(dict.STATS_CARD_FAILED, "error");
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
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <ScreenHeader
        title={dict.STATS_TITLE}
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: endPadding }]}
        refreshControl={
          <AppRefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
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

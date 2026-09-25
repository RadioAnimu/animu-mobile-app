import { useCallback, useState } from "react";
import { DrawerScreenProps } from "@react-navigation/drawer";
import { useFocusEffect } from "@react-navigation/native";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Background } from "@/components/Background";
import { ScreenHeader } from "@/components/ScreenHeader";
import {
  listenStatsService,
  type ListenStatsSnapshot,
} from "@/core/services/listen-stats.service";
import { useDict } from "@/hooks/useDict";
import { RootStackParamList } from "@/routes/app.routes";
import { StatsContent } from "@/screens/Stats/StatsContent";
import { styles } from "@/screens/Stats/styles";

type Props = DrawerScreenProps<RootStackParamList, "Stats">;

/**
 * On-device listening stats: overview, six-month heatmap with day
 * drill-down, streaks and an hour/weekday listening profile. Everything
 * shown is measured locally — nothing leaves the phone.
 */
export function Stats({ navigation }: Props) {
  const dict = useDict();
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

  const hasData =
    (snap?.totalMs ?? 0) > 0 || (snap?.totalSubmitted ?? 0) > 0;

  return (
    <Background>
      <SafeAreaView
        style={styles.container}
        edges={["left", "right", "bottom"]}
      >
        <ScreenHeader
          title={dict.STATS_TITLE}
          onBack={() => navigation.goBack()}
        />
        <ScrollView contentContainerStyle={styles.content}>
          {hasData && snap ? (
            <StatsContent
              snap={snap}
              dict={dict}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
            />
          ) : (
            <View style={[styles.group, styles.emptyCard]}>
              <Text style={styles.emptyTitle}>{dict.STATS_EMPTY_TITLE}</Text>
              <Text style={styles.emptyText}>{dict.STATS_EMPTY}</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Background>
  );
}

import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { View } from "react-native";

import { SectionTitle } from "@/components/SectionTitle";
import { listenStatsService } from "@/core/services/listen-stats.service";
import { useDict } from "@/hooks/useDict";
import { ValueRow } from "@/screens/Settings/rows";
import { styles } from "@/screens/Settings/styles";
import { formatListenDuration } from "@/utils/format";

interface Props {
  onPress: () => void;
}

/**
 * Listen stats entry point — a ValueRow whose trailing value is the
 * all-time listening total, opened right after the Account card. The value
 * re-reads on every focus, so a listening session that ended since the last
 * visit is reflected without an app restart (drawer screens stay mounted).
 */
export function ListenStatsSection({ onPress }: Props) {
  const dict = useDict();
  const [totalLabel, setTotalLabel] = useState<string>("—");

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listenStatsService
        .initialize()
        .then(() => {
          if (!alive) return;
          const { totalMs } = listenStatsService.getSnapshot();
          setTotalLabel(
            totalMs > 0 ? formatListenDuration(totalMs / 60_000) : "—",
          );
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, []),
  );

  return (
    <>
      <SectionTitle title={dict.STATS_TITLE} icon="bar-chart" />
      <View style={styles.group}>
        <ValueRow
          label={dict.STATS_SETTINGS_ROW}
          icon="insights"
          value={totalLabel}
          onPress={onPress}
        />
      </View>
    </>
  );
}

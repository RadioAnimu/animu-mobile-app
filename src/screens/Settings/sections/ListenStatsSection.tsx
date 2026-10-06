import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

import { listenStatsService } from "@/core/services/listen-stats.service";
import { useDict } from "@/hooks/useDict";
import { ValueRow } from "@/screens/Settings/rows";
import { formatListenDuration, listenDurationUnits } from "@/utils/format";

interface Props {
  onPress: () => void;
}

/**
 * Listen stats entry row — a ValueRow whose trailing value is the
 * all-time listening total, sharing the Account card. The value
 * re-reads on every focus, so a listening session that ended since the last
 * visit is reflected without an app restart (drawer screens stay mounted).
 */
export function ListenStatsSection({ onPress }: Readonly<Props>) {
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
            totalMs > 0
              ? formatListenDuration(
                  totalMs / 60_000,
                  listenDurationUnits(dict),
                )
              : "—",
          );
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, [dict]),
  );

  return (
    <ValueRow
      label={dict.STATS_SETTINGS_ROW}
      icon="insights"
      value={totalLabel}
      onPress={onPress}
    />
  );
}

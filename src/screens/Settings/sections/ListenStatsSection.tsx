import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

import { listenStatsService } from "@/core/services/listen-stats.service";
import { useDict } from "@/hooks/useDict";
import type { Dict } from "@/i18n";
import { ValueRow } from "@/screens/Settings/rows";
import { formatListenDuration, listenDurationUnits } from "@/utils/format";

interface Props {
  onPress: () => void;
}

type TotalState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "failed" }
  | { status: "ready"; label: string };

function visibleTotal(
  total: TotalState,
  dict: Dict,
): { text: string; spoken?: string } {
  switch (total.status) {
    case "ready":
      return { text: total.label };
    case "empty":
      return { text: "—", spoken: dict.SETTINGS_STATS_EMPTY };
    case "failed":
      return { text: dict.SETTINGS_VALUE_FAILED };
    default:
      return { text: dict.SETTINGS_VALUE_LOADING };
  }
}

/**
 * Listen stats entry row — a ValueRow whose trailing value is the
 * all-time listening total, sharing the Account card. The value
 * re-reads on every focus, so a listening session that ended since the last
 * visit is reflected without an app restart (drawer screens stay mounted).
 * Loading, nothing-recorded and a failed read look and sound different: a
 * dash that stood for all three hid a broken read behind "no listening".
 */
export function ListenStatsSection({ onPress }: Readonly<Props>) {
  const dict = useDict();
  const [total, setTotal] = useState<TotalState>({ status: "loading" });

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listenStatsService
        .initialize()
        .then(() => {
          if (!alive) return;
          const { totalMs } = listenStatsService.getSnapshot();
          setTotal(
            totalMs > 0
              ? {
                  status: "ready",
                  label: formatListenDuration(
                    totalMs / 60_000,
                    listenDurationUnits(dict),
                  ),
                }
              : { status: "empty" },
          );
        })
        .catch((error) => {
          console.warn("[ListenStats] settings row read failed:", error);
          if (alive) setTotal({ status: "failed" });
        });
      return () => {
        alive = false;
      };
    }, [dict]),
  );

  const shown = visibleTotal(total, dict);

  return (
    <ValueRow
      label={dict.STATS_SETTINGS_ROW}
      icon="insights"
      description={dict.SETTINGS_STATS_DESC}
      value={shown.text}
      spokenValue={shown.spoken}
      onPress={onPress}
    />
  );
}

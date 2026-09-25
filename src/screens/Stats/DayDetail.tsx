import { Text, View } from "react-native";

import type { ListenDay } from "@/core/services/listen-stats.service";
import type { Dict } from "@/i18n";
import { styles } from "@/screens/Stats/styles";
import { formatListenDuration } from "@/utils/format";

/**
 * Drill-down for one heatmap day: totals row plus the 24-hour mini
 * histogram (raw per-hour data exists for the recent window only).
 */
export function DayDetail({
  dayKey,
  day,
  dict,
}: {
  dayKey: string;
  day: ListenDay;
  dict: Dict;
}) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const thisYear = new Date().getFullYear();
  const title =
    `${dict.STATS_MONTHS[m - 1]} ${d}` +
    (y !== thisYear ? ` ${y}` : "");

  const maxHour = Math.max(...day.hours, 0);
  const weekdayLabel = dict.STATS_DOW[date.getDay()];

  const stats: [string, string][] = [
    [dict.STATS_TOTAL, formatListenDuration(day.ms / 60_000)],
    [dict.STATS_SESSIONS, `${day.sessions}`],
    [dict.STATS_SONGS, `${day.tracks}`],
  ];
  if (day.requests > 0) {
    stats.push([dict.STATS_REQUESTED, `${day.requests}`]);
  }
  if (day.submitted > 0 || day.shouts > 0) {
    stats.push([
      dict.STATS_REQUESTS_SENT,
      `${day.submitted + day.shouts}`,
    ]);
  }

  return (
    <View style={styles.cardPadding}>
      <Text style={styles.dayTitle}>
        {weekdayLabel} · {title}
      </Text>
      <View style={styles.dayGrid}>
        {stats.map(([label, value]) => (
          <View key={label} style={styles.statItem}>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={styles.statValue}>{value}</Text>
          </View>
        ))}
      </View>
      {maxHour > 0 && (
        <View style={styles.barsRow}>
          {day.hours.map((ms, h) => (
            <View
              key={h}
              style={[
                styles.bar,
                { height: Math.max(2, Math.round((ms / maxHour) * 72)) },
                ms > 0 && h === day.hours.indexOf(maxHour) && styles.barPeak,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

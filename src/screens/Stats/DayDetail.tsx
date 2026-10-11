import { Text, View } from "react-native";

import type { ListenDay } from "@/core/services/listen-stats.service";
import type { Dict } from "@/i18n";
import { dayKeyToDate, formatDayKey } from "@/screens/Stats/dates";
import { ProfileBars } from "@/screens/Stats/ProfileBars";
import { buildHourBars } from "@/screens/Stats/profile";
import { styles } from "@/screens/Stats/styles";
import { formatListenDuration, listenDurationUnits } from "@/utils/format";

/**
 * Drill-down for one heatmap day: its totals plus the 24-hour histogram
 * (raw per-hour data exists for the recent window only, so older days show
 * the totals alone). A day without listening says so instead of a grid of
 * zeros.
 */
export function DayDetail({
  dayKey,
  day,
  isToday,
  dict,
}: Readonly<{
  dayKey: string;
  day: ListenDay | undefined;
  isToday: boolean;
  dict: Dict;
}>) {
  const weekday = dict.STATS_DOW_LONG[dayKeyToDate(dayKey).getDay()];

  const stats: [string, string][] = [];
  if (day && day.ms > 0) {
    stats.push(
      [dict.STATS_TOTAL, formatListenDuration(day.ms / 60_000, listenDurationUnits(dict))],
      [dict.STATS_SESSIONS, `${day.sessions}`],
      [dict.STATS_SONGS, `${day.tracks}`],
    );
  }
  if (day && day.requests > 0) stats.push([dict.STATS_REQUESTED, `${day.requests}`]);
  if (day && day.submitted > 0) stats.push([dict.STATS_REQUESTS_SENT, `${day.submitted}`]);
  if (day && day.shouts > 0) stats.push([dict.STATS_SHOUTOUTS, `${day.shouts}`]);

  const hasHours = day?.hours.some((ms) => ms > 0) ?? false;

  return (
    <View style={styles.dayDetail}>
      <View style={styles.dayHeader}>
        <Text style={styles.dayTitle}>
          {weekday}, {formatDayKey(dayKey, dict)}
        </Text>
        {isToday && <Text style={styles.caption}>{dict.STATS_TODAY}</Text>}
      </View>
      {stats.length === 0 ? (
        <Text style={styles.caption}>{dict.STATS_DAY_EMPTY}</Text>
      ) : (
        <View style={styles.dayGrid}>
          {stats.map(([label, value]) => (
            <View key={label} style={styles.dayStat}>
              <Text style={styles.dayStatValue}>{value}</Text>
              <Text numberOfLines={2} style={styles.caption}>
                {label}
              </Text>
            </View>
          ))}
        </View>
      )}
      {day && hasHours && (
        <ProfileBars
          bars={buildHourBars([day])}
          emptyLabel={dict.STATS_PROFILE_EMPTY}
          axis="hours"
        />
      )}
    </View>
  );
}

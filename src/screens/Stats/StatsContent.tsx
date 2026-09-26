import { useState } from "react";
import { Alert, Text, View } from "react-native";

import { DestructiveAction } from "@/components/DestructiveAction";
import { SectionTitle } from "@/components/SectionTitle";
import type { ListenStatsSnapshot } from "@/core/services/listen-stats.service";
import type { Dict } from "@/i18n";
import { DayDetail } from "@/screens/Stats/DayDetail";
import { Heatmap } from "@/screens/Stats/Heatmap";
import type { ProfileBar } from "@/screens/Stats/ProfileBars";
import { ProfileBars } from "@/screens/Stats/ProfileBars";
import { styles } from "@/screens/Stats/styles";
import { haptics } from "@/utils/haptics";
import { formatListenDuration, interpolate } from "@/utils/format";

/** Overview grid rows: [label, value] pairs. */
const buildOverview = (
  snap: ListenStatsSnapshot,
  dict: Dict,
): [string, string][] => [
  [dict.STATS_TOTAL, formatListenDuration(snap.totalMs / 60_000)],
  [dict.STATS_DAYS, `${snap.activeDays}`],
  [dict.STATS_SESSIONS, `${snap.totalSessions}`],
  [dict.STATS_SONGS, `${snap.totalTracks}`],
  [dict.STATS_REQUESTED, `${snap.totalRequestTracks}`],
  [dict.STATS_REQUESTS_SENT, `${snap.totalSubmitted}`],
  [dict.STATS_SHOUTOUTS, `${snap.totalShouts}`],
];

/** Summed per-hour listening across all recorded days. */
const buildHourBars = (snap: ListenStatsSnapshot): ProfileBar[] =>
  Array.from({ length: 24 }, (_, h) => ({
    id: `hour-${h}`,
    value: Object.values(snap.days).reduce((sum, d) => sum + d.hours[h], 0),
    // Label every 6 hours — 24 labels wrap at this bar width.
    label: h % 6 === 0 ? `${h}` : "",
  }));

/** Summed per-weekday listening across all recorded days. */
const buildWeekdayBars = (snap: ListenStatsSnapshot, dict: Dict): ProfileBar[] => {
  const totals = Array<number>(7).fill(0);
  for (const [key, d] of Object.entries(snap.days)) {
    const [y, m, dd] = key.split("-").map(Number);
    totals[new Date(y, m - 1, dd).getDay()] += d.ms;
  }
  return totals.map((value, wd) => ({
    id: `dow-${wd}`,
    value,
    label: dict.STATS_DOW[wd],
  }));
};

const streakLabel = (days: number, dict: Dict): string =>
  days === 1
    ? dict.STATS_STREAK_DAY
    : interpolate(dict.STATS_STREAK_DAYS, { n: days });

interface Props {
  snap: ListenStatsSnapshot;
  dict: Dict;
  selectedDay: string | null;
  onSelectDay: (day: string | null) => void;
  onReset: () => void;
}

/** The data-backed body of the stats screen (everything but the empty state). */
export function StatsContent({
  snap,
  dict,
  selectedDay,
  onSelectDay,
  onReset,
}: Props) {
  const [resetting, setResetting] = useState(false);
  const selectedData = selectedDay != null ? snap.days[selectedDay] : undefined;

  const confirmReset = () => {
    Alert.alert(
      dict.STATS_RESET_CONFIRM_TITLE,
      dict.STATS_RESET_CONFIRM_MSG,
      [
        { text: dict.ACCOUNT_CANCEL, style: "cancel" },
        {
          text: dict.STATS_RESET_CONFIRM,
          style: "destructive",
          onPress: () => {
            haptics.warning();
            void (async () => {
              setResetting(true);
              try {
                await onReset();
              } finally {
                setResetting(false);
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <>
      <SectionTitle title={dict.STATS_OVERVIEW_TITLE} icon="bar-chart" />
      <View style={[styles.group, styles.overview]}>
        {buildOverview(snap, dict).map(([label, value]) => (
          <View key={label} style={styles.statItem}>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={styles.statValue}>{value}</Text>
          </View>
        ))}
      </View>

      <SectionTitle title={dict.STATS_HEATMAP_TITLE} icon="calendar-month" />
      <View style={styles.group}>
        <Heatmap
          days={snap.days}
          selected={selectedDay}
          onSelect={onSelectDay}
          dict={dict}
        />
      </View>
      <Text style={styles.hint}>{dict.STATS_HEATMAP_HINT}</Text>
      {selectedDay != null && selectedData != null && (
        <View style={[styles.group, styles.detailGap]}>
          <DayDetail dayKey={selectedDay} day={selectedData} dict={dict} />
        </View>
      )}

      <SectionTitle title={dict.STATS_STREAK_TITLE} icon="local-fire-department" />
      <View style={styles.group}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{dict.STATS_STREAK_CURRENT}</Text>
          <Text style={styles.rowValue}>
            {streakLabel(snap.currentStreak, dict)}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{dict.STATS_STREAK_LONGEST}</Text>
          <Text style={styles.rowValue}>
            {streakLabel(snap.maxStreak, dict)}
          </Text>
        </View>
      </View>

      <SectionTitle title={dict.STATS_PROFILE_TITLE} icon="insights" />
      <View style={[styles.group, styles.profileGroup]}>
        <View>
          <Text style={styles.profileCaption}>{dict.STATS_PROFILE_HOURS}</Text>
          <ProfileBars
            bars={buildHourBars(snap)}
            emptyLabel={dict.STATS_PROFILE_EMPTY}
          />
        </View>
        <View>
          <Text style={styles.profileCaption}>
            {dict.STATS_PROFILE_WEEKDAYS}
          </Text>
          <ProfileBars
            bars={buildWeekdayBars(snap, dict)}
            emptyLabel={dict.STATS_PROFILE_EMPTY}
          />
        </View>
      </View>

      <SectionTitle title={dict.SETTINGS_ADVANCED_TITLE} icon="settings" />
      <DestructiveAction
        icon="delete-sweep"
        label={dict.STATS_RESET_ROW}
        busy={resetting}
        onPress={confirmReset}
      />

      <Text style={styles.footnote}>{dict.STATS_ON_DEVICE}</Text>
    </>
  );
}

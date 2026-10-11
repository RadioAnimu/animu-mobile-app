import { useState } from "react";
import { Alert, Text, View } from "react-native";

import { DestructiveAction } from "@/components/DestructiveAction";
import { Icon, type IconName } from "@/components/Icon";
import { SectionTitle } from "@/components/SectionTitle";
import type { ListenStatsSnapshot } from "@/core/services/listen-stats.service";
import { dayKeyOf } from "@/core/services/listen-stats.service";
import type { Dict } from "@/i18n";
import { formatDayKey } from "@/screens/Stats/dates";
import { DayDetail } from "@/screens/Stats/DayDetail";
import { Heatmap } from "@/screens/Stats/Heatmap";
import {
  buildHourBars,
  buildWeekdayBars,
  formatHour,
  peakIndex,
} from "@/screens/Stats/profile";
import { ProfileBars } from "@/screens/Stats/ProfileBars";
import { styles } from "@/screens/Stats/styles";
import { TopList } from "@/screens/Stats/TopList";
import { THEME } from "@/theme";
import { haptics } from "@/utils/haptics";
import {
  formatListenDuration,
  formatStreakLabel,
  interpolate,
  listenDurationUnits,
} from "@/utils/format";

/** Rows in the screen's top-requests list. */
const TOP_SHOWN = 5;

interface Tile {
  icon: IconName;
  label: string;
  value: string;
}

/** Overview tiles under the hero total — streaks first, then the counters. */
const buildTiles = (snap: ListenStatsSnapshot, dict: Dict): Tile[] => [
  {
    icon: "local-fire-department",
    label: dict.STATS_STREAK_CURRENT,
    value: formatStreakLabel(snap.currentStreak, dict),
  },
  {
    icon: "emoji-events",
    label: dict.STATS_STREAK_LONGEST,
    value: formatStreakLabel(snap.maxStreak, dict),
  },
  { icon: "event-available", label: dict.STATS_DAYS, value: `${snap.activeDays}` },
  { icon: "headphones", label: dict.STATS_SESSIONS, value: `${snap.totalSessions}` },
  { icon: "music-note", label: dict.STATS_SONGS, value: `${snap.totalTracks}` },
  { icon: "queue-music", label: dict.STATS_REQUESTED, value: `${snap.totalRequestTracks}` },
  { icon: "send", label: dict.STATS_REQUESTS_SENT, value: `${snap.totalSubmitted}` },
  { icon: "campaign", label: dict.STATS_SHOUTOUTS, value: `${snap.totalShouts}` },
];

interface Props {
  snap: ListenStatsSnapshot;
  dict: Dict;
  selectedDay: string | null;
  onSelectDay: (day: string | null) => void;
  /** Awaited so the reset button shows busy until the wipe completes. */
  onReset: () => Promise<void>;
}

/** The data-backed body of the stats screen (everything but the empty state). */
export function StatsContent({
  snap,
  dict,
  selectedDay,
  onSelectDay,
  onReset,
}: Readonly<Props>) {
  const [resetting, setResetting] = useState(false);
  const units = listenDurationUnits(dict);

  const heroMeta = [
    snap.firstDayAt > 0 &&
      interpolate(dict.STATS_SINCE, {
        date: formatDayKey(dayKeyOf(snap.firstDayAt), dict),
      }),
    snap.bestDayMs > 0 &&
      interpolate(dict.STATS_BEST_DAY, {
        value: formatListenDuration(snap.bestDayMs / 60_000, units),
      }),
  ]
    .filter(Boolean)
    .join(" · ");

  const hourBars = buildHourBars(Object.values(snap.days));
  const weekdayBars = buildWeekdayBars(snap.days, dict);
  const peakHour = peakIndex(hourBars);
  const peakWeekday = peakIndex(weekdayBars);

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
      <View style={[styles.group, styles.hero]}>
        <Text style={styles.caption}>{dict.STATS_TOTAL}</Text>
        <Text style={styles.heroValue}>
          {formatListenDuration(snap.totalMs / 60_000, units)}
        </Text>
        {heroMeta.length > 0 && <Text style={styles.heroMeta}>{heroMeta}</Text>}
      </View>
      <View style={styles.tiles}>
        {buildTiles(snap, dict).map((tile) => (
          <View
            key={tile.label}
            accessible
            accessibilityLabel={`${tile.label}: ${tile.value}`}
            style={styles.tile}
          >
            <Icon name={tile.icon} size={THEME.ICON.SM} color={THEME.COLORS.BRAND} />
            <Text numberOfLines={1} style={styles.tileValue}>
              {tile.value}
            </Text>
            <Text numberOfLines={2} style={styles.tileLabel}>
              {tile.label}
            </Text>
          </View>
        ))}
      </View>

      <SectionTitle title={dict.STATS_TOP_REQUESTS} icon="queue-music" />
      <TopList
        dict={dict}
        items={snap.topRequests.slice(0, TOP_SHOWN).map((r, i) => ({
          key: `${i}-${r.art}-${r.title}`,
          title: r.title || dict.STATS_REQUEST_EARLIER,
          subtitle: [r.artist, r.anime].filter(Boolean).join(" · "),
          art: r.art,
          count: r.requests,
        }))}
      />

      <SectionTitle title={dict.STATS_HEATMAP_TITLE} icon="calendar-month" />
      <View style={styles.group}>
        <Heatmap
          days={snap.days}
          todayKey={snap.todayKey}
          selected={selectedDay}
          onSelect={onSelectDay}
          dict={dict}
        />
        {selectedDay != null && (
          <>
            <View style={styles.divider} />
            <DayDetail
              dayKey={selectedDay}
              day={snap.days[selectedDay]}
              isToday={selectedDay === snap.todayKey}
              dict={dict}
            />
          </>
        )}
      </View>

      <SectionTitle title={dict.STATS_PROFILE_TITLE} icon="insights" />
      <View style={[styles.group, styles.profileGroup]}>
        <View style={styles.profileBlock}>
          <View style={styles.profileHeader}>
            <Text style={styles.caption}>{dict.STATS_PROFILE_HOURS}</Text>
            {peakHour >= 0 && (
              <Text style={styles.profilePeak}>
                {interpolate(dict.STATS_PEAK, { value: formatHour(peakHour) })}
              </Text>
            )}
          </View>
          <ProfileBars
            bars={hourBars}
            emptyLabel={dict.STATS_PROFILE_EMPTY}
            axis="hours"
          />
        </View>
        <View style={styles.profileBlock}>
          <View style={styles.profileHeader}>
            <Text style={styles.caption}>{dict.STATS_PROFILE_WEEKDAYS}</Text>
            {peakWeekday >= 0 && (
              <Text style={styles.profilePeak}>
                {interpolate(dict.STATS_PEAK, {
                  value: dict.STATS_DOW_LONG[peakWeekday],
                })}
              </Text>
            )}
          </View>
          <ProfileBars bars={weekdayBars} emptyLabel={dict.STATS_PROFILE_EMPTY} />
        </View>
      </View>

      <SectionTitle title={dict.SETTINGS_ADVANCED_TITLE} icon="settings" />
      <DestructiveAction
        icon="delete-sweep"
        label={dict.STATS_RESET_ROW}
        busy={resetting}
        onPress={confirmReset}
      />
    </>
  );
}

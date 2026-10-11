import React from "react";
import { Text, View } from "react-native";

import { peakIndex } from "@/screens/Stats/profile";
import { styles } from "@/screens/Stats/styles";

/** One bar of the distribution strip: a value plus its stable axis id. */
export interface ProfileBar {
  id: string;
  value: number;
  label: string;
}

/** Hours labelled on the 24-bar axis. */
const HOUR_TICKS = [0, 6, 12, 18];

/**
 * Compact bar strip used by the listening profile and the day drill-down
 * (hour-of-day and weekday distribution). The tallest bar is highlighted in
 * full brand green and zero bars render as faint stubs so the axis still
 * reads; an all-zero series renders the empty caption instead.
 *
 * `axis="hours"` expects 24 bars and labels every sixth hour at its bar's
 * left edge; the default puts each bar's own label centered under it.
 */
export function ProfileBars({
  bars,
  emptyLabel,
  axis = "labels",
}: Readonly<{
  bars: ProfileBar[];
  emptyLabel: string;
  axis?: "labels" | "hours";
}>) {
  const peak = peakIndex(bars);
  if (peak < 0) {
    return <Text style={styles.caption}>{emptyLabel}</Text>;
  }
  const max = bars[peak].value;
  return (
    <View accessible={false}>
      <View style={styles.barsRow}>
        {bars.map((bar, i) => (
          <View
            key={bar.id}
            style={[
              styles.bar,
              {
                height: `${Math.max(3, Math.round((bar.value / max) * 100))}%`,
              },
              bar.value <= 0 && styles.barEmpty,
              i === peak && styles.barPeak,
            ]}
          />
        ))}
      </View>
      <View style={styles.barsBaseline} />
      {axis === "hours" ? (
        <View style={styles.hourAxis}>
          {HOUR_TICKS.map((h) => (
            <Text
              key={h}
              style={[styles.barLabelHour, { left: `${(h / 24) * 100}%` }]}
            >
              {h}
            </Text>
          ))}
        </View>
      ) : (
        <View style={styles.barsLabels}>
          {bars.map((bar) => (
            <Text key={bar.id} numberOfLines={1} style={styles.barLabel}>
              {bar.label}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

import React from "react";
import { Text, View } from "react-native";

import { styles } from "@/screens/Stats/styles";

/** One bar of the distribution strip: a value plus its stable axis id. */
export interface ProfileBar {
  id: string;
  value: number;
  label: string;
}

/**
 * Compact bar strip used by the listening profile (hour-of-day and weekday
 * distribution). The tallest bar is highlighted in full brand green; an
 * all-zero series renders the empty caption instead.
 */
export function ProfileBars({
  bars,
  emptyLabel,
}: {
  bars: ProfileBar[];
  emptyLabel: string;
}) {
  const max = Math.max(...bars.map((b) => b.value), 0);
  if (max <= 0) {
    return <Text style={styles.emptyText}>{emptyLabel}</Text>;
  }
  const peakId = bars.find((b) => b.value === max)?.id;
  return (
    <View>
      <View style={styles.barsRow}>
        {bars.map((bar) => (
          <View
            key={bar.id}
            style={[
              styles.bar,
              { height: Math.max(2, Math.round((bar.value / max) * 72)) },
              bar.id === peakId && styles.barPeak,
            ]}
          />
        ))}
      </View>
      <View style={styles.barsLabels}>
        {bars.map((bar) => (
          <Text key={bar.id} numberOfLines={1} style={styles.barLabel}>
            {bar.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

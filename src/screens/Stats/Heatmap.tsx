import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

import type { ListenDay } from "@/core/services/listen-stats.service";
import { dayKeyOf } from "@/core/services/listen-stats.service";
import type { Dict } from "@/i18n";
import {
  HEAT_CELL,
  HEAT_GAP,
  HEAT_LEVELS,
  HEAT_WEEKS,
  styles,
} from "@/screens/Stats/styles";
import { THEME } from "@/theme";

interface Cell {
  key: string;
  future: boolean;
  ms: number;
}


/** Heat level for a day's listening: 0 (none) … 4 (90m+). */
const levelOf = (ms: number): number => {
  if (ms < 60_000) return 0;
  if (ms < 15 * 60_000) return 1;
  if (ms < 45 * 60_000) return 2;
  if (ms < 90 * 60_000) return 3;
  return 4;
};

const dayStartMs = (dayKey: string): number => {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
};

/**
 * GitHub-style listening heatmap: one column per week (Sun → Sat), the last
 * six months. Tap a day to select it (tap again to deselect) — the screen
 * shows a drill-down below the grid.
 */
export function Heatmap({
  days,
  selected,
  onSelect,
  dict,
}: Readonly<{
  days: Record<string, ListenDay>;
  selected: string | null;
  onSelect: (day: string | null) => void;
  dict: Dict;
}>) {
  const today = new Date();
  const todayMs = dayStartMs(dayKeyOf(today.getTime()));
  // Snap to the Sunday that starts the current week, then walk back a full
  // week per column — HEAT_WEEKS columns ending "this week".
  const first = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() - (HEAT_WEEKS - 1) * 7);

  const weeks: Cell[][] = [];
  const monthLabels: ({ index: number; label: string } | null)[] = [];
  let lastMonth = -1;
  let lastLabelAt = -3;
  for (let w = 0; w < HEAT_WEEKS; w++) {
    const columnDate = new Date(first.getFullYear(), first.getMonth(), first.getDate() + w * 7);
    const column: Cell[] = [];
    for (let d = 0; d < 7; d++) {
      // Calendar arithmetic keeps local midnight and weekdays aligned at DST.
      const cellMs = new Date(columnDate.getFullYear(), columnDate.getMonth(), columnDate.getDate() + d).getTime();
      const key = dayKeyOf(cellMs);
      // Days after today render as invisible placeholders (grid alignment).
      column.push({
        key,
        future: cellMs > todayMs,
        ms: days[key]?.ms ?? 0,
      });
    }
    weeks.push(column);
    const month = columnDate.getMonth();
    // Skip a label when the previous one is too close (consecutive weeks
    // changing month would overlap at one column apart).
    if (month !== lastMonth && w - lastLabelAt >= 2) {
      monthLabels.push({ index: w, label: dict.STATS_MONTHS[month] });
      lastLabelAt = w;
    } else {
      monthLabels.push(null);
    }
    lastMonth = month;
  }

  const dowVisible = new Set([1, 3, 5]); // Mon / Wed / Fri markers
  const DOW_IDS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const LEVEL_IDS = ["empty", "light", "lightplus", "mid", "full"];

  return (
    <View>
      <ScrollView
        horizontal
        // The day navigator exposes the same drill-down with comfortable
        // controls and avoids 180 tiny cells in TalkBack/VoiceOver's order.
        accessibilityElementsHidden
        collapsable={false}
        importantForAccessibility="no-hide-descendants"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.heatGrid}
        style={styles.heatScroll}
      >
        <View>
          <View style={styles.heatMonthRow}>
            {monthLabels.map((label) =>
              label ? (
                <Text
                  key={label.label + label.index}
                  style={[
                    styles.heatMonthLabel,
                    { left: label.index * (HEAT_CELL + HEAT_GAP) },
                  ]}
                >
                  {label.label}
                </Text>
              ) : null,
            )}
          </View>
          <View style={styles.heatBodyRow}>
            <View style={styles.heatDowColumn}>
              {dict.STATS_DOW.map((letter, i) => (
                <Text key={DOW_IDS[i]} style={styles.heatDowLabel}>
                  {dowVisible.has(i) ? letter : ""}
                </Text>
              ))}
            </View>
            {weeks.map((column) => (
              <View key={column[0].key} style={styles.heatWeek}>
                {column.map((cell) => {
                  if (cell.future) {
                    return <View key={cell.key} style={styles.heatCell} />;
                  }
                  const isSelected = cell.key === selected;
                  return (
                    <TouchableOpacity
                      key={cell.key}
                      accessible={false}
                      importantForAccessibility="no"
                      activeOpacity={THEME.OPACITY.PRESSED}
                      onPress={() =>
                        onSelect(isSelected ? null : cell.key)
                      }
                      style={[
                        styles.heatCell,
                        { backgroundColor: HEAT_LEVELS[levelOf(cell.ms)] },
                        isSelected && styles.heatCellSelected,
                      ]}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      <View style={styles.heatLegend}>
        <Text style={styles.heatLegendLabel}>{dict.STATS_LESS}</Text>
        {HEAT_LEVELS.map((color, i) => (
          <View
            key={LEVEL_IDS[i]}
            style={[styles.heatLegendCell, { backgroundColor: color }]}
          />
        ))}
        <Text style={styles.heatLegendLabel}>{dict.STATS_MORE}</Text>
      </View>
    </View>
  );
}

import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

import type { ListenDay } from "@/core/services/listen-stats.service";
import type { Dict } from "@/i18n";
import { formatDayKey } from "@/screens/Stats/dates";
import { buildWeeks, fitGrid, levelOf } from "@/screens/Stats/heatmap-grid";
import { HEAT_GAP, HEAT_LEVELS, styles } from "@/screens/Stats/styles";
import { THEME } from "@/theme";
import {
  formatListenDuration,
  interpolate,
  listenDurationUnits,
} from "@/utils/format";

const DOW_IDS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const LEVEL_IDS = ["empty", "light", "lightplus", "mid", "full"];
/** Mon / Wed / Fri carry a letter; the other rows stay unlabelled. */
const DOW_VISIBLE = new Set([1, 3, 5]);

/**
 * GitHub-style listening heatmap: one column per week (Sun → Sat) ending
 * with this week, sized to fill the card. Tap a day to select it (tap again
 * to deselect) — the screen shows its drill-down under the grid.
 */
export function Heatmap({
  days,
  todayKey,
  selected,
  onSelect,
  dict,
}: Readonly<{
  days: Record<string, ListenDay>;
  /** The snapshot's "today" — the grid ends with its week. */
  todayKey: string;
  selected: string | null;
  onSelect: (day: string | null) => void;
  dict: Dict;
}>) {
  const [width, setWidth] = useState(0);
  const { weeks, cell } = fitGrid(width);
  const { columns, months } = buildWeeks(weeks, days, todayKey);
  const step = cell + HEAT_GAP;
  const units = listenDurationUnits(dict);

  return (
    <View style={styles.heatCard}>
      <Text style={styles.caption}>
        {/* The week count depends on the measured width — no wrong
            number flashes before the first layout. */}
        {width > 0 ? interpolate(dict.STATS_HEATMAP_RANGE, { n: weeks }) : " "}
      </Text>
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 && (
          <>
            <View style={styles.heatMonthRow}>
              {months.map(({ index, month }) => (
                <Text
                  key={`${month}-${index}`}
                  numberOfLines={1}
                  style={[
                    styles.heatMonthLabel,
                    // The last columns anchor right so the label can't
                    // overflow the card edge.
                    index >= weeks - 2 ? { right: 0 } : { left: index * step },
                  ]}
                >
                  {dict.STATS_MONTHS[month]}
                </Text>
              ))}
            </View>
            <View style={styles.heatBodyRow}>
              <View style={styles.heatDowColumn}>
                {dict.STATS_DOW.map((letter, i) => (
                  <Text
                    key={DOW_IDS[i]}
                    style={[
                      styles.heatDowLabel,
                      { height: cell, lineHeight: cell },
                    ]}
                  >
                    {DOW_VISIBLE.has(i) ? letter : ""}
                  </Text>
                ))}
              </View>
              <View style={styles.heatWeeks}>
                {columns.map((column) => (
                  <View key={column[0].key} style={styles.heatWeek}>
                    {column.map((c) => {
                      const size = { width: cell, height: cell };
                      if (c.future) {
                        return <View key={c.key} style={size} />;
                      }
                      const isSelected = c.key === selected;
                      return (
                        <TouchableOpacity
                          key={c.key}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                          // Localized date + duration — what screen readers
                          // announce instead of a raw ISO key.
                          accessibilityLabel={`${formatDayKey(c.key, dict)}: ${formatListenDuration(c.ms / 60_000, units)}`}
                          activeOpacity={THEME.OPACITY.PRESSED}
                          onPress={() => onSelect(isSelected ? null : c.key)}
                          style={[
                            styles.heatCell,
                            size,
                            { backgroundColor: HEAT_LEVELS[levelOf(c.ms)] },
                            c.key === todayKey && styles.heatCellToday,
                            isSelected && styles.heatCellSelected,
                          ]}
                        />
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
      </View>
      <View style={styles.heatFooter}>
        <Text style={[styles.caption, { flexShrink: 1 }]}>
          {dict.STATS_HEATMAP_HINT}
        </Text>
        <View style={styles.heatLegend} accessible={false}>
          <Text style={styles.caption}>{dict.STATS_LESS}</Text>
          {HEAT_LEVELS.map((color, i) => (
            <View
              key={LEVEL_IDS[i]}
              style={[styles.heatLegendCell, { backgroundColor: color }]}
            />
          ))}
          <Text style={styles.caption}>{dict.STATS_MORE}</Text>
        </View>
      </View>
    </View>
  );
}
